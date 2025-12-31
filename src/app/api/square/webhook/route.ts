// src/app/api/square/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

// Set this in your env (Square webhook signature key):
// - SQUARE_WEBHOOK_SIGNATURE_KEY
// Optional (only if you want to force a specific URL for signature calc):
// - SQUARE_WEBHOOK_URL (example: https://kallr.solutions/api/square/webhook)

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function getPublicUrl(req: NextRequest) {
  const forced = process.env.SQUARE_WEBHOOK_URL;
  if (forced) return forced;

  // Build a stable public URL (Vercel / proxies)
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const path = req.nextUrl.pathname;
  return `${proto}://${host}${path}`;
}

function computeSquareSignature(signatureKey: string, notificationUrl: string, body: string) {
  const hmac = crypto.createHmac("sha256", signatureKey);
  hmac.update(notificationUrl + body, "utf8");
  return hmac.digest("base64");
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "square/webhook" });
}

export async function POST(req: NextRequest) {
  // 1) Read raw body (Square signature requires raw)
  const raw = await req.text().catch(() => "");
  if (!raw) return NextResponse.json({ ok: false, error: "Empty body" }, { status: 400 });

  // 2) Verify signature (recommended)
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";
  const provided = req.headers.get("x-square-hmacsha256-signature") || "";

  if (signatureKey) {
    const notificationUrl = getPublicUrl(req);
    const expected = computeSquareSignature(signatureKey, notificationUrl, raw);

    if (!provided || !constantTimeEqual(provided, expected)) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }
  }

  // 3) If you don’t need to process events yet, just ACK fast
  // (Square expects a quick 200)
  return NextResponse.json({ ok: true });
}
