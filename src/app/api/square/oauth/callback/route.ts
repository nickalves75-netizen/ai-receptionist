// src/app/api/square/oauth/callback/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/g, "");
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const oauthError = url.searchParams.get("error");
    const oauthErrorDesc = url.searchParams.get("error_description") || "";
    if (oauthError) {
      return NextResponse.json(
        { ok: false, error: oauthError, description: oauthErrorDesc },
        { status: 400 }
      );
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json({ ok: false, error: "Missing code or state" }, { status: 400 });
    }

    // --- Verify & parse state ---
    const stateSecret = getEnv("SQUARE_STATE_SECRET");
    const parts = state.split(".");
    if (parts.length !== 2) {
      return NextResponse.json({ ok: false, error: "Invalid state format" }, { status: 400 });
    }
    const [payloadB64, sigB64] = parts;

    const expectedSig = b64url(crypto.createHmac("sha256", stateSecret).update(payloadB64).digest());
    if (!timingSafeEqual(sigB64, expectedSig)) {
      return NextResponse.json({ ok: false, error: "Invalid state signature" }, { status: 400 });
    }

    let payload: any;
    try {
      const json = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      payload = JSON.parse(json);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid state payload" }, { status: 400 });
    }

    const clientId = payload?.client_id as string | undefined;
    const redirectTo = (payload?.redirect_to as string | undefined) || "/internal";
    if (!clientId) {
      return NextResponse.json({ ok: false, error: "State missing client_id" }, { status: 400 });
    }

    // ✅ Use actual request origin so redirect_uri matches Square exactly (www vs non-www)
    const origin = url.origin;
    const kallrBase = normalizeBaseUrl(process.env.KALLR_PUBLIC_URL ? normalizeBaseUrl(process.env.KALLR_PUBLIC_URL) : origin);
    const redirectUri = `${origin}/api/square/oauth/callback`;

    // --- Exchange code for tokens (Square ObtainToken) ---
    const applicationId = getEnv("SQUARE_APPLICATION_ID");
    const applicationSecret = getEnv("SQUARE_APPLICATION_SECRET");

    const tokenRes = await fetch("https://connect.squareup.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: applicationId,
        client_secret: applicationSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenJson = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok) {
      return NextResponse.json(
        { ok: false, error: "Square token exchange failed", details: tokenJson },
        { status: 500 }
      );
    }

    const accessToken = (tokenJson as any)?.access_token as string | undefined;
    const refreshToken = (tokenJson as any)?.refresh_token as string | undefined;
    const expiresAt = (tokenJson as any)?.expires_at as string | undefined;
    const merchantId = (tokenJson as any)?.merchant_id as string | undefined;

    if (!accessToken || !merchantId) {
      return NextResponse.json(
        { ok: false, error: "Square response missing access_token or merchant_id", details: tokenJson },
        { status: 500 }
      );
    }

    // --- Get seller locations so we can store default location_id ---
    const locRes = await fetch("https://connect.squareup.com/v2/locations", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
      },
    });

    const locJson = await locRes.json().catch(() => ({}));
    let locationId: string | null = null;

    if (locRes.ok && Array.isArray((locJson as any)?.locations) && (locJson as any).locations.length > 0) {
      locationId = (locJson as any).locations[0]?.id || null;
    }

    // --- Store per-client credentials in Supabase ---
    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ ok: false, error: "Server missing Supabase config" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    const { error: upsertErr } = await supabase
      .from("clients")
      .upsert(
        {
          id: clientId,
          square_merchant_id: merchantId,
          square_access_token: accessToken,
          square_refresh_token: refreshToken || null,
          square_expires_at: expiresAt || null,
          square_location_id: locationId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (upsertErr) {
      return NextResponse.json(
        { ok: false, error: "Failed saving Square credentials", details: upsertErr },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL(redirectTo, kallrBase));
  } catch (e: any) {
    console.error("square oauth callback crashed:", e);
    return NextResponse.json(
      { ok: false, error: "Server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}