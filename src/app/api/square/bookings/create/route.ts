// src/app/api/square/bookings/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createBooking, upsertCustomer, normalizeEmail, normalizePhone } from "@/lib/square";

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

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message: "POST JSON to create a Square booking.",
      preferred_shape: {
        availability: { start_at: "ISO", location_id: "ID", appointment_segments: [{ duration_minutes: 0, team_member_id: "ID", service_variation_id: "ID", service_variation_version: 0 }] },
        customer: { given_name: "First", family_name: "Last", email: "email", phone: "phone" },
        notes: "optional",
      },
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

  // Accept both the NEW shape (availability object) and your LEGACY shape (flat fields)
  const availability = coerceJsonMaybe(body.availability) || {};
  const customerIn = coerceJsonMaybe(body.customer) || {};

  const location_id = String(
    availability.location_id ||
      body.location_id ||
      process.env.SQUARE_LOCATION_ID ||
      ""
  );

  const start_at = String(availability.start_at || body.start_at || "");

  // appointment_segments can arrive as JSON string if the tool schema was wrong
  const appointment_segments = coerceJsonMaybe(availability.appointment_segments || body.appointment_segments);

  if (!location_id) {
    return NextResponse.json({ ok: false, error: "Missing location_id (or SQUARE_LOCATION_ID env)", debug_id }, { status: 400 });
  }
  if (!start_at) {
    return NextResponse.json({ ok: false, error: "Missing start_at", debug_id }, { status: 400 });
  }
  if (!Array.isArray(appointment_segments) || appointment_segments.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing appointment_segments[] (tip: pass the availability object from the availability tool)", debug_id },
      { status: 400 }
    );
  }

  // Normalize customer inputs (speech-to-text safe)
  const customer = {
    given_name: String(customerIn.given_name || customerIn.first_name || "").trim() || undefined,
    family_name: String(customerIn.family_name || customerIn.last_name || "").trim() || undefined,
    email: normalizeEmail(customerIn.email || customerIn.email_address),
    phone: normalizePhone(customerIn.phone || customerIn.phone_number),
  };

  // IMPORTANT: do NOT fail booking just because email is invalid.
  // We'll upsert using email/phone if possible, otherwise create a new customer record.
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
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to create/find Square customer",
        debug_id: upsert.debug_id,
        square_trace_id: upsert.square_trace_id,
        square_errors: upsert.square_errors,
        hint:
          "Most common causes: invalid email/phone, missing SQUARE_ACCESS_TOKEN in production env, or token lacks permissions.",
      },
      { status: 502 }
    );
  }

  const notes = typeof body.notes === "string" ? body.notes : undefined;

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
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to create booking in Square",
        debug_id: booking.debug_id,
        square_trace_id: booking.square_trace_id,
        square_errors: booking.square_errors,
      },
      { status: 502 }
    );
  }

  const bookingId = booking.data?.booking?.id;

  return NextResponse.json(
    {
      ok: true,
      debug_id: booking.debug_id,
      square_trace_id: booking.square_trace_id,
      booking_id: bookingId,
      booking: booking.data?.booking,
    },
    { status: 200 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
