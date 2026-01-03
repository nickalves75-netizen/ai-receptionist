import { NextRequest, NextResponse } from "next/server";
import { createBooking, upsertCustomer, normalizeEmail, normalizePhone } from "@/lib/square";

export const runtime = "nodejs";

function deny(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 401 });
}

function requireSecret(req: NextRequest) {
  const expected = process.env.VAPI_TOOL_SECRET;
  if (!expected) return true; // allow if unset (not recommended)
  const got =
    req.headers.get("x-kallr-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return got === expected;
}

function coerceJsonMaybe(v: any) {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return v;
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try {
      return JSON.parse(s);
    } catch {
      return v;
    }
  }
  return v;
}

function jsonError(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

async function squareFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://connect.squareup.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const square_trace_id =
    res.headers.get("square-trace-id") || res.headers.get("x-request-id") || undefined;

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { res, json, square_trace_id };
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message:
        "POST JSON to create a Square booking. If booking_id is provided, updates the existing booking instead of creating a duplicate.",
      preferred_shape: {
        booking_id: "(optional) existing booking id to update",
        availability: {
          start_at: "ISO",
          location_id: "ID",
          appointment_segments: [
            {
              duration_minutes: 0,
              team_member_id: "ID",
              service_variation_id: "ID",
              service_variation_version: 0,
            },
          ],
        },
        customer: { given_name: "First", family_name: "Last", email: "email", phone: "phone" },
        service_name: "Platinum Detail",
        vehicle: "2018 Audi A4 (Coupe/Sedan)",
        address_text: "123 Main St, Boston, MA",
        notes: "optional",
      },
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  if (!requireSecret(req)) return deny("Unauthorized");

  const debug_id = crypto.randomUUID();

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return jsonError(500, { ok: false, error: "Missing SQUARE_ACCESS_TOKEN", debug_id });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonError(400, { ok: false, error: "Invalid JSON", debug_id });
  }

  const booking_id = typeof body.booking_id === "string" && body.booking_id.trim() ? body.booking_id.trim() : "";

  // Accept NEW shape (availability object) and legacy flat fields
  const availability = coerceJsonMaybe(body.availability) || {};
  const customerIn = coerceJsonMaybe(body.customer) || {};

  const location_id = String(
    availability.location_id || body.location_id || process.env.SQUARE_LOCATION_ID || ""
  );

  const start_at = String(availability.start_at || body.start_at || "");

  // appointment_segments can arrive as JSON string if tool schema is wrong
  const appointment_segments = coerceJsonMaybe(availability.appointment_segments || body.appointment_segments);

  if (!location_id) {
    return jsonError(400, { ok: false, error: "Missing location_id (or SQUARE_LOCATION_ID env)", debug_id });
  }
  if (!start_at && !booking_id) {
    return jsonError(400, { ok: false, error: "Missing start_at", debug_id });
  }
  if (!booking_id) {
    if (!Array.isArray(appointment_segments) || appointment_segments.length === 0) {
      return jsonError(400, {
        ok: false,
        error:
          "Missing appointment_segments[] (tip: pass the chosen availability slot object from squareAvailability)",
        debug_id,
      });
    }
  }

  // Normalize customer inputs (speech-to-text safe)
  const customer = {
    given_name: String(customerIn.given_name || customerIn.first_name || "").trim() || undefined,
    family_name: String(customerIn.family_name || customerIn.last_name || "").trim() || undefined,
    email: normalizeEmail(customerIn.email || customerIn.email_address),
    phone: normalizePhone(customerIn.phone || customerIn.phone_number),
  };

  // Upsert customer (do not fail booking just because email is missing/invalid)
  const upsert = await upsertCustomer(
    {
      given_name: customer.given_name,
      family_name: customer.family_name,
      email: customer.email,
      phone: customer.phone,
    },
    debug_id
  );

  if (!upsert.ok) {
    return jsonError(502, {
      ok: false,
      error: "Failed to create/find Square customer",
      debug_id: upsert.debug_id,
      square_trace_id: upsert.square_trace_id,
      square_errors: upsert.square_errors,
    });
  }

  // Enrich notes so Square booking always contains useful details
  const notesParts: string[] = [];
  if (typeof body.notes === "string" && body.notes.trim()) notesParts.push(body.notes.trim());

  const addr = (body.address_text || body.service_address || customerIn.address_text || "").toString().trim();
  const vehicle = (body.vehicle || body.vehicle_text || body.vehicle_year_make_model || "").toString().trim();
  const serviceName = (body.service_name || "").toString().trim();

  if (serviceName) notesParts.push(`Service: ${serviceName}`);
  if (vehicle) notesParts.push(`Vehicle: ${vehicle}`);
  if (addr) notesParts.push(`Address: ${addr}`);

  const notes = notesParts.length ? notesParts.join(" | ") : "Booked via Kallr";

  // UPDATE PATH: if booking_id is provided, update existing booking instead of creating a duplicate
  if (booking_id) {
    // 1) Read current booking to get version
    const get = await squareFetch(token, `/v2/bookings/${encodeURIComponent(booking_id)}`, { method: "GET" });
    if (!get.res.ok) {
      return jsonError(502, {
        ok: false,
        error: `Square API error (${get.res.status})`,
        debug_id,
        square_trace_id: get.square_trace_id,
        square_errors: get.json?.errors,
      });
    }

    const current = get.json?.booking;
    const version = current?.version;

    if (typeof version !== "number") {
      return jsonError(502, {
        ok: false,
        error: "Could not read booking version for update",
        debug_id,
        square_trace_id: get.square_trace_id,
      });
    }

    // 2) Update booking with corrected customer + note (keep time/segments unchanged)
    const updateBody = {
      idempotency_key: crypto.randomUUID(),
      booking: {
        id: booking_id,
        version,
        customer_id: upsert.data.customer_id,
        customer_note: notes,
      },
    };

    const put = await squareFetch(token, `/v2/bookings/${encodeURIComponent(booking_id)}`, {
      method: "PUT",
      body: JSON.stringify(updateBody),
    });

    if (!put.res.ok) {
      return jsonError(502, {
        ok: false,
        error: `Square API error (${put.res.status})`,
        debug_id,
        square_trace_id: put.square_trace_id,
        square_errors: put.json?.errors,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        debug_id,
        square_trace_id: put.square_trace_id,
        booking_id,
        booking: put.json?.booking,
        updated: true,
      },
      { status: 200 }
    );
  }

  // CREATE PATH
  const booking = await createBooking(
    {
      location_id,
      start_at,
      customer_id: upsert.data.customer_id,
      customer_note: notes,
      appointment_segments,
    },
    debug_id
  );

  if (!booking.ok) {
    return jsonError(502, {
      ok: false,
      error: "Failed to create booking in Square",
      debug_id: booking.debug_id,
      square_trace_id: booking.square_trace_id,
      square_errors: booking.square_errors,
    });
  }

  const newId = booking.data?.booking?.id;

  return NextResponse.json(
    {
      ok: true,
      debug_id: booking.debug_id,
      square_trace_id: booking.square_trace_id,
      booking_id: newId,
      booking: booking.data?.booking,
      updated: false,
    },
    { status: 200 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
