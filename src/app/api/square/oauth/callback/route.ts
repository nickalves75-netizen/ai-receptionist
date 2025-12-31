// src/app/api/square/oauth/callback/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * STATE FORMAT (signed):
 * state = `${payloadB64}.${sigB64}`
 *
 * payloadB64 = base64url(JSON.stringify({ client_id: "uuid-or-id", redirect_to?: "/internal/..." }))
 * sigB64     = base64url(HMAC_SHA256(payloadB64, SQUARE_STATE_SECRET))
 *
 * We'll generate this in /api/square/oauth/start later.
 */

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
  return url.replace(/\/+$/g, ""); // strip trailing slashes
}

export async function GET(req: Request) {
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
    return NextResponse.json(
      { ok: false, error: "Missing code or state" },
      { status: 400 }
    );
  }

  // --- Verify & parse state ---
  const stateSecret = getEnv("SQUARE_STATE_SECRET");
  const parts = state.split(".");
  if (parts.length !== 2) {
    return NextResponse.json(
      { ok: false, error: "Invalid state format" },
      { status: 400 }
    );
  }
  const [payloadB64, sigB64] = parts;

  const expectedSig = b64url(
    crypto.createHmac("sha256", stateSecret).update(payloadB64).digest()
  );

  if (!timingSafeEqual(sigB64, expectedSig)) {
    return NextResponse.json(
      { ok: false, error: "Invalid state signature" },
      { status: 400 }
    );
  }

  let payload: any;
  try {
    const json = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8"
    );
    payload = JSON.parse(json);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid state payload" },
      { status: 400 }
    );
  }

  const clientId = payload?.client_id as string | undefined;
  const redirectTo = (payload?.redirect_to as string | undefined) || "/internal";

  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: "State missing client_id" },
      { status: 400 }
    );
  }

  // --- Exchange code for tokens (Square ObtainToken) ---
  const applicationId = getEnv("SQUARE_APPLICATION_ID");
  const applicationSecret = getEnv("SQUARE_APPLICATION_SECRET");
  const kallrBase = normalizeBaseUrl(getEnv("KALLR_PUBLIC_URL"));

  const redirectUri = `${kallrBase}/api/square/oauth/callback`;

  const tokenRes = await fetch("https://connect.squareup.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: applicationId,
      client_secret: applicationSecret,
      code,
      grant_type: "authorization_code",
      // Keep this included so it matches your Square OAuth settings precisely.
      redirect_uri: redirectUri,
    }),
  });

  const tokenJson = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json(
      { ok: false, error: "Square token exchange failed", details: tokenJson },
      { status: 500 }
    );
  }

  const accessToken = tokenJson.access_token as string | undefined;
  const refreshToken = tokenJson.refresh_token as string | undefined;
  const expiresAt = tokenJson.expires_at as string | undefined;
  const merchantId = tokenJson.merchant_id as string | undefined;

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
      // Optional but recommended versioning; safe default.
      "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
    },
  });

  const locJson = await locRes.json();
  let locationId: string | null = null;

  if (locRes.ok && Array.isArray(locJson?.locations) && locJson.locations.length > 0) {
    // Pick the first location (you can later add UI to choose).
    locationId = locJson.locations[0]?.id || null;
  }

  // --- Store per-client credentials in Supabase (NOT in env) ---
  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseServiceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  // Upsert into your clients table.
  // Expected columns (minimum):
  // id (text/uuid), square_merchant_id (text), square_access_token (text),
  // square_refresh_token (text nullable), square_expires_at (timestamptz/text nullable),
  // square_location_id (text nullable), updated_at (timestamptz default now)
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

  // Done → send you back into Kallr UI
  return NextResponse.redirect(new URL(redirectTo, kallrBase));
}
