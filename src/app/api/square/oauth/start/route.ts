// src/app/api/square/oauth/start/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/g, "");
}

/**
 * Creates a signed state so we can safely round-trip client_id through Square OAuth.
 * state = `${payloadB64}.${sigB64}`
 */
function signState(payload: object, secret: string) {
  const payloadB64 = b64url(JSON.stringify(payload));
  const sigB64 = b64url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  return `${payloadB64}.${sigB64}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Required: which client in YOUR system is connecting Square
  const clientId = url.searchParams.get("client_id");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Missing client_id" }, { status: 400 });
  }

  // Optional: where to send user after successful connect
  const redirectTo = url.searchParams.get("redirect_to") || "/internal";

  const appId = getEnv("SQUARE_APPLICATION_ID");
  const kallrBase = normalizeBaseUrl(getEnv("KALLR_PUBLIC_URL"));
  const stateSecret = getEnv("SQUARE_STATE_SECRET");

  const redirectUri = `${kallrBase}/api/square/oauth/callback`;

  // Start minimal. You can expand scopes later.
  const scopes = [
    "APPOINTMENTS_READ",
    "APPOINTMENTS_WRITE",
    "CUSTOMERS_READ",
    "CUSTOMERS_WRITE",
    "MERCHANT_PROFILE_READ",
    "ITEMS_READ",
  ].join(" ");

  const state = signState({ client_id: clientId, redirect_to: redirectTo }, stateSecret);

  const authUrl = new URL("https://connect.squareup.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("session", "false"); // recommended for production

  return NextResponse.redirect(authUrl.toString());
}
