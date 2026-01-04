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

function isIsoUtcZ(s: string) {
  // We require UTC "Z" to prevent timezone mistakes (ET vs UTC).
  return typeof s === "string" && /Z$/.test(s) && !isNaN(new Date(s).getTime());
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message:
        "POST JSON to create a Square booking. Preferred: pass the chosen option object from /api/square/availability (options[i]).",
      preferred_shape: {
        booking_id: "(optional) existing booking id to update instead of creating duplicate",
        option: {
          // directly pass ONE item from squareAvailability.options[]
          start_at_utc: "2026-01-05T17:30:00Z",
          display_et: "Monday, January 5th at 12:30 PM Eastern",
          location_id: "LC....",
          appointment_segments: [
            {
              duration_minutes: 150,
              team_member_id: "TM....",
              service_variation_id: "7D....",
              service_variation_version: 123,
            },
          ],
        },
        customer: { given_name: "First", family_name: "Last", email: "email", phone: "phone" },
        service_name: "Platinum Detail",
        vehicle: "2025 Tesla Model 3 (Coupe)",
        address_text: "123 Main St, Stoughton, MA 02072",
        notes: "optional",
      },
      important: [
        "Do NOT pass local time. start_at must be UTC and end with 'Z'.",
        "Best practice: always book using option.start_at_utc from availability options[].",
      ],
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

  // Accept:
  // - option (preferred): one item from availability.options[]
  // - availability (legacy): chosen availability slot object
  // - legacy flat fields: start_at, location_id, appointment_segments
  const option = coerceJsonMaybe(body.option || body.chosen_option || body.slot) || {};
  const availability = coerceJsonMaybe(body.availability) || {};
  const customerIn = coerceJsonMaybe(body.customer) || {};

  const location_id = String(
    option.location_id ||
      availability.location_id ||
      body.location_id ||
      process.env.SQUARE_LOCATION_ID ||
      ""
  );

  const start_at = String(
    option.start_at_utc ||
      availability.start_at ||
      body.start_at ||
      ""
  );

  const appointment_segments = coerceJsonMaybe(
    option.appointment_segments ||
      availability.appointment_segments ||
      body.appointment_segments
  );

  if (!location_id) {
    return jsonError(400, { ok: false, error: "Missing location_id (or SQUARE_LOCATION_ID env)", debug_id });
  }

  if (!booking_id) {
    if (!start_at) {
      return jsonError(400, {
        ok: false,
        error: "Missing start_at. Pass option.start_at_utc from availability.options[]",
        debug_id,
      });
    }

    // HARD GUARD AGAINST TIMEZONE BUGS:
    // If we allow non-Z, the assistant will keep booking wrong.
    if (!isIsoUtcZ(start_at)) {
      return jsonError(400, {
        ok: false,
        error:
          "start_at must be a valid UTC ISO string ending with 'Z' (example: 2026-01-05T17:30:00Z). Use option.start_at_utc from /api/square/availability options[].",
        debug_id,
        received_start_at: start_at,
      });
    }

    if (!Array.isArray(appointment_segments) || appointment_segments.length === 0) {
      return jsonError(400, {
        ok: false,
        error:
          "Missing appointment_segments[] (tip: pass the chosen option object from squareAvailability.options[])",
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

  // Upsert customer
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

  // EXTRA HARDENING:
  // Ensure phone/email are actually persisted even if upsertCustomer matched an existing record.
  // If this fails, we still proceed (booking note will contain details).
  let ensured_customer_update = false;
  try {
    const updateBody: any = {};
    if (customer.given_name) updateBody.given_name = customer.given_name;
    if (customer.family_name) updateBody.family_name = customer.family_name;
    if (customer.email) updateBody.email_address = customer.email;
    if (customer.phone) updateBody.phone_number = customer.phone;

    if (Object.keys(updateBody).length > 0) {
      const put = await squareFetch(token, `/v2/customers/${encodeURIComponent(upsert.data.customer_id)}`, {
        method: "PUT",
        body: JSON.stringify(updateBody),
      });
      ensured_customer_update = put.res.ok;
    }
  } catch {
    ensured_customer_update = false;
  }

  // Enrich notes so Square booking always contains useful details
  const notesParts: string[] = [];

  // Always include a stable origin tag
  notesParts.push("Booked via Kallr");

  const rawNotes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (rawNotes) notesParts.push(rawNotes);

  const addr = (body.address_text || body.service_address || customerIn.address_text || "")
    .toString()
    .trim();
  const vehicle = (body.vehicle || body.vehicle_text || body.vehicle_year_make_model || "")
    .toString()
    .trim();
  const serviceName = (body.service_name || body.service || "")
    .toString()
    .trim();

  if (serviceName) notesParts.push(`Service: ${serviceName}`);
  if (vehicle) notesParts.push(`Vehicle: ${vehicle}`);
  if (addr) notesParts.push(`Address: ${addr}`);

  // Force phone/email to show on the appointment even if Square UI doesn't surface customer fields
  if (customer.phone) notesParts.push(`Phone: ${customer.phone}`);
  if (customer.email) notesParts.push(`Email: ${customer.email}`);

  const notes = notesParts.join(" | ");

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
        ensured_customer_update,
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
      ensured_customer_update,
    },
    { status: 200 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
