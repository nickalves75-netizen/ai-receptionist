// src/app/api/square/availability/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function requireSecret(req: NextRequest) {
  const expected = process.env.VAPI_TOOL_SECRET;
  if (!expected) return true; // allows calls if unset (not recommended)
  const got =
    req.headers.get("x-kallr-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return got === expected;
}

function jsonError(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message:
        "POST { service_variation_ids: [..] } to search Square availability. This endpoint searches the next 14 days, and if empty, automatically extends forward in 14-day windows up to 90 days ahead.",
      expects: {
        service_variation_ids: ["<base_id>", "<addon_id_optional>"],
      },
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  if (!requireSecret(req)) {
    return jsonError(401, { ok: false, error: "Unauthorized" });
  }

  const debug_id = crypto.randomUUID();

  const token = process.env.SQUARE_ACCESS_TOKEN;
  const location_id = process.env.SQUARE_LOCATION_ID;

  if (!token) return jsonError(500, { ok: false, error: "Missing SQUARE_ACCESS_TOKEN", debug_id });
  if (!location_id) return jsonError(500, { ok: false, error: "Missing SQUARE_LOCATION_ID", debug_id });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonError(400, { ok: false, error: "Invalid JSON", debug_id });
  }

  const ids = body?.service_variation_ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((x: any) => typeof x !== "string" || !x.trim())) {
    return jsonError(400, {
      ok: false,
      error: "service_variation_ids must be a non-empty array of strings",
      debug_id,
    });
  }

  // Always search from "now" forward (do NOT trust tool-provided dates).
  const now = new Date();
  const baseStart = new Date(now.getTime() + 5 * 60 * 1000); // +5 minutes buffer

  const WINDOW_DAYS = 14;
  const MAX_DAYS_AHEAD = 90; // auto-search up to ~3 months out
  const maxEnd = new Date(baseStart.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000);

  let attempt = 0;
  let found: any = null;
  let lastError: any = null;

  while (true) {
    const start = new Date(baseStart.getTime() + attempt * WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

    if (start >= maxEnd) break;
    if (end > maxEnd) end.setTime(maxEnd.getTime());

    const payload = {
      query: {
        filter: {
          location_id,
          start_at_range: {
            start_at: start.toISOString(),
            end_at: end.toISOString(),
          },
          segment_filters:
            ids.length > 1
              ? ids.map((sid: string) => ({ service_variation_id: sid }))
              : [{ service_variation_id: ids[0] }],
        },
      },
    };

    const res = await fetch("https://connect.squareup.com/v2/bookings/availability/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const square_trace_id =
      res.headers.get("square-trace-id") || res.headers.get("x-request-id") || undefined;

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      lastError = {
        ok: false,
        error: `Square API error (${res.status})`,
        debug_id,
        square_trace_id,
        square_errors: json?.errors,
        meta: {
          used_location_id: location_id,
          used_start_at: start.toISOString(),
          used_end_at: end.toISOString(),
          used_service_variation_ids: ids,
          attempt_window_index: attempt,
        },
      };
      break;
    }

    const av = json?.availabilities || [];
    if (av.length > 0) {
      found = {
        ok: true,
        debug_id,
        square_trace_id,
        meta: {
          used_location_id: location_id,
          used_start_at: start.toISOString(),
          used_end_at: end.toISOString(),
          used_service_variation_ids: ids,
          attempt_window_index: attempt,
        },
        availability: {
          availabilities: av,
          errors: json?.errors || [],
        },
      };
      break;
    }

    attempt += 1;
  }

  if (found) return NextResponse.json(found, { status: 200 });
  if (lastError) return NextResponse.json(lastError, { status: 502 });

  return NextResponse.json(
    {
      ok: true,
      debug_id,
      availability: { availabilities: [], errors: [] },
      meta: {
        used_location_id: location_id,
        used_start_at: baseStart.toISOString(),
        used_end_at: maxEnd.toISOString(),
        used_service_variation_ids: ids,
        note: `No availability found in the next ${MAX_DAYS_AHEAD} days.`,
      },
    },
    { status: 200 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
