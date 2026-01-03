import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function requireSecret(req: NextRequest) {
  const expected = process.env.VAPI_TOOL_SECRET;
  if (!expected) return true; // not recommended, but keeps dev from breaking if unset
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
      message: "POST { service_variation_ids: [..] } to search availability for the next 14 days.",
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
  if (!Array.isArray(ids) || ids.length === 0) {
    return jsonError(400, { ok: false, error: "service_variation_ids must be a non-empty array", debug_id });
  }

  // ALWAYS search from now (with a small buffer) out 14 days.
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60 * 1000); // +5 minutes
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

  const payload = {
    query: {
      filter: {
        location_id,
        start_at_range: {
          start_at: start.toISOString(),
          end_at: end.toISOString(),
        },
        segment_filters: [
          {
            service_variation_id: ids[0],
          },
        ],
      },
    },
  };

  // If you pass multiple ids (base + add-on), Square availability search expects segment_filters.
  // We'll include each as a segment filter.
  if (ids.length > 1) {
    payload.query.filter.segment_filters = ids.map((sid: string) => ({ service_variation_id: sid }));
  }

  const res = await fetch("https://connect.squareup.com/v2/bookings/availability/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const square_trace_id =
    res.headers.get("square-trace-id") ||
    res.headers.get("x-request-id") ||
    undefined;

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    return jsonError(502, {
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
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      debug_id,
      square_trace_id,
      meta: {
        used_location_id: location_id,
        used_start_at: start.toISOString(),
        used_end_at: end.toISOString(),
        used_service_variation_ids: ids,
      },
      availability: {
        availabilities: json?.availabilities || [],
        errors: json?.errors || [],
      },
    },
    { status: 200 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
