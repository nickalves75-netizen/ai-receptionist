// src/app/api/square/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchAvailability } from "@/lib/square";

export const runtime = "nodejs";

function deny(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 401 });
}

function requireSecret(req: NextRequest) {
  const expected = process.env.VAPI_TOOL_SECRET;
  if (!expected) return true; // allow if you didn't set it yet (not recommended)
  const got = req.headers.get("x-kallr-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return got === expected;
}

function toIso(d: Date) {
  return d.toISOString();
}

function coerceDate(raw?: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  // So your browser test doesn't show 405
  return NextResponse.json(
    {
      ok: true,
      message: "POST JSON to this endpoint to search Square availability.",
      required: ["service_variation_ids"],
      optional: ["start_at", "end_at", "location_id", "client_id"],
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  if (!requireSecret(req)) return deny("Unauthorized");

  const debug_id = crypto.randomUUID();

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON", debug_id }, { status: 400 });
  }

  const location_id = String(body.location_id || process.env.SQUARE_LOCATION_ID || "");
  const service_variation_ids = Array.isArray(body.service_variation_ids)
    ? body.service_variation_ids.map(String)
    : [];

  if (!location_id) {
    return NextResponse.json({ ok: false, error: "Missing location_id (or SQUARE_LOCATION_ID env)", debug_id }, { status: 400 });
  }
  if (!service_variation_ids.length) {
    return NextResponse.json({ ok: false, error: "Missing service_variation_ids[]", debug_id }, { status: 400 });
  }

  const now = new Date();
  const startRaw = coerceDate(body.start_at);
  const endRaw = coerceDate(body.end_at);

  // If Vapi sends 2023/past: clamp to a safe future window
  const start = !startRaw || startRaw.getTime() < now.getTime() - 60_000 ? now : startRaw;
  const end =
    !endRaw || endRaw.getTime() <= start.getTime()
      ? new Date(start.getTime() + 7 * 24 * 60 * 60_000) // default: 7 days forward
      : endRaw;

  const result = await searchAvailability(
    {
      location_id,
      service_variation_ids,
      start_at: toIso(start),
      end_at: toIso(end),
    },
    debug_id
  );

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(
    {
      ok: true,
      debug_id: result.debug_id,
      square_trace_id: result.square_trace_id,
      availability: result.data,
      meta: { location_id, start_at: toIso(start), end_at: toIso(end), service_variation_ids },
    },
    { status: 200 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
