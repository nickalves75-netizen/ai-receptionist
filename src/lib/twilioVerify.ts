import type { NextRequest } from "next/server";
import twilio from "twilio";

/**
 * Twilio signs the EXACT public URL it requests.
 * Behind Vercel/proxies, reconstruct the public URL from forwarded headers.
 */
function firstHeaderValue(v: string | null): string {
  if (!v) return "";
  return v.split(",")[0].trim();
}

function getPublicUrl(req: NextRequest): string {
  const url = new URL(req.url);

  // Prefer forwarded headers (correct behind Vercel / proxies)
  const proto = firstHeaderValue(req.headers.get("x-forwarded-proto")) || "https";
  const host =
    firstHeaderValue(req.headers.get("x-forwarded-host")) ||
    firstHeaderValue(req.headers.get("host"));

  // If host is missing for some reason, fall back to req.url as-is
  if (!host) return req.url;

  return `${proto}://${host}${url.pathname}${url.search}`;
}

export async function verifyTwilioRequest(req: NextRequest, rawBody: string) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) throw new Error("Missing TWILIO_AUTH_TOKEN");

  const signature = req.headers.get("x-twilio-signature") || "";

  // Twilio validation expects POST params as an object
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const publicUrl = getPublicUrl(req);

  const isValid = twilio.validateRequest(token, signature, publicUrl, params);
  if (!isValid) throw new Error("Invalid Twilio signature");
}
