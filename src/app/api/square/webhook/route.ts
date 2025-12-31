// src/app/api/square/webhook/route.ts
import { NextRequest } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Ensure Node runtime (we use node:crypto)
export const runtime = "nodejs";

function constantTimeEqual(a: string, b: string) {
  if (!a || !b) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function computeSquareSignature(notificationUrl: string, rawBody: string, signatureKey: string) {
  // Square: base64(hmac_sha256(notification_url + body, signature_key))
  const payload = `${notificationUrl}${rawBody}`;
  return crypto.createHmac("sha256", signatureKey).update(payload, "utf8").digest("base64");
}

export async function GET() {
  return new Response("SQUARE WEBHOOK OK", { status: 200 });
}

export async function POST(req: NextRequest) {
  // Read raw body (must be raw for signature verification)
  const rawBody = await req.text().catch(() => "");

  // Square signature header
  const receivedSig = req.headers.get("x-square-hmacsha256-signature") || "";

  // These two env vars should be set in Vercel (recommended)
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";
  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || "";

  // If envs are set, verify; if not set, allow (so you don’t block prod unexpectedly)
  if (signatureKey && notificationUrl) {
    const expectedSig = computeSquareSignature(notificationUrl, rawBody, signatureKey);
    if (!constantTimeEqual(receivedSig, expectedSig)) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // Parse JSON if possible (Square webhooks are JSON)
  let body: any = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    body = null;
  }

  // Optional: log/store for debugging (safe even if you don’t use it yet)
  try {
    await supabaseAdmin.from("square_webhook_events").insert({
      received_at: new Date().toISOString(),
      event_type: body?.type ?? null,
      event_id: body?.event_id ?? body?.eventId ?? null,
      payload: body ?? { raw: rawBody },
    });
  } catch {
    // Ignore DB errors so Square still gets 200 and doesn't retry forever
  }

  return new Response("OK", { status: 200 });
}
