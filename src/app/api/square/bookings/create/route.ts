// src/app/api/square/bookings/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type CustomerBody = {
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
};

type Segment = {
  duration_minutes: number;
  team_member_id: string;
  service_variation_id: string;
  service_variation_version: number;
};

type Body = {
  client_id: string;
  start_at: string;
  location_id?: string;

  appointment_segments?: Segment[] | Segment | string;
  availability_segments?: Segment[] | Segment | string;

  customer: CustomerBody;
  notes?: string;
};

function normalizeSegments(input: any): Segment[] | null {
  if (!input) return null;

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return normalizeSegments(parsed);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(input) && typeof input === "object") return [input as Segment];
  if (Array.isArray(input)) return input as Segment[];

  return null;
}

function cleanEmail(raw?: string) {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  const lower = s.toLowerCase();
  const junk = ["n/a", "na", "none", "null", "undefined", "no", "noemail", "no email"];
  if (junk.includes(lower)) return undefined;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  if (!ok) return undefined;
  return s;
}

function cleanPhone(raw?: string) {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  const lower = s.toLowerCase();
  const junk = ["n/a", "na", "none", "null", "undefined", "no", "nophone", "no phone"];
  if (junk.includes(lower)) return undefined;
  return s;
}

async function squareJson(url: string, opts: RequestInit) {
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function findOrCreateSquareCustomer(params: {
  accessToken: string;
  customer: CustomerBody;
  debugId: string;
}) {
  const { accessToken, customer, debugId } = params;

  const email = cleanEmail(customer.email);
  const phone = cleanPhone(customer.phone);

  // Try search by ONE identifier (email preferred)
  if (email || phone) {
    const filter = email
      ? { email_address: { exact: email } }
      : { phone_number: { exact: phone } };

    const { res: searchRes, json: searchJson } = await squareJson(
      "https://connect.squareup.com/v2/customers/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
        },
        body: JSON.stringify({ query: { filter }, limit: 1 }),
      }
    );

    if (searchRes.ok) {
      const found = searchJson?.customers?.[0]?.id;
      if (found) return found as string;
    } else {
      console.error("[square][customer_search_failed]", debugId, {
        status: searchRes.status,
        details: searchJson,
      });
    }
  }

  // Create (email optional; phone optional)
  const payload: any = {
    given_name: (customer.first_name || "").trim(),
    family_name: (customer.last_name || "").trim() || undefined,
    email_address: email,
    phone_number: phone,
  };

  // Remove undefined fields
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const { res: createRes, json: createJson } = await squareJson(
    "https://connect.squareup.com/v2/customers",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
      },
      body: JSON.stringify(payload),
    }
  );

  if (createRes.ok) {
    const id = createJson?.customer?.id;
    if (id) return id as string;
  }

  console.error("[square][customer_create_failed]", debugId, {
    status: createRes.status,
    details: createJson,
    sent: { hasEmail: !!email, hasPhone: !!phone },
  });

  return null;
}

export async function POST(req: Request) {
  const debugId = `bk_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.client_id || !body?.start_at || !body?.customer?.first_name) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields", debug_id: debugId },
      { status: 400 }
    );
  }

  const segments =
    normalizeSegments(body.appointment_segments) ||
    normalizeSegments(body.availability_segments);

  if (!segments || segments.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Must provide appointment_segments or availability_segments", debug_id: debugId },
      { status: 400 }
    );
  }

  const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("square_access_token,square_location_id")
    .eq("id", body.client_id)
    .single();

  if (clientErr || !client?.square_access_token) {
    return NextResponse.json(
      { ok: false, error: "Client missing Square connection", details: clientErr, debug_id: debugId },
      { status: 400 }
    );
  }

  const locationId = (body.location_id || client.square_location_id || "").trim();
  if (!locationId) {
    return NextResponse.json({ ok: false, error: "Missing location_id", debug_id: debugId }, { status: 400 });
  }

  // Attempt customer create, but DO NOT block booking if it fails
  const customerId = await findOrCreateSquareCustomer({
    accessToken: client.square_access_token,
    customer: body.customer,
    debugId,
  });

  const idempotencyKey =
    (globalThis as any)?.crypto?.randomUUID?.() || `kallr_${Date.now()}_${Math.random()}`;

  // Always include a note with customer details so the booking is useful even without customer_id
  const fallbackNoteParts = [
    `Name: ${(body.customer.first_name || "").trim()} ${(body.customer.last_name || "").trim()}`.trim(),
    body.customer.phone ? `Phone: ${body.customer.phone}` : null,
    body.customer.email ? `Email: ${body.customer.email}` : null,
    body.notes ? `Notes: ${body.notes}` : null,
  ].filter(Boolean);

  const booking: any = {
    start_at: body.start_at,
    location_id: locationId,
    appointment_segments: segments,
    customer_note: fallbackNoteParts.join(" | ") || undefined,
  };

  if (customerId) booking.customer_id = customerId;

  const payload: any = { idempotency_key: idempotencyKey, booking };

  const { res, json } = await squareJson("https://connect.squareup.com/v2/bookings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.square_access_token}`,
      "Content-Type": "application/json",
      "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error("[square][booking_create_failed]", debugId, {
      status: res.status,
      details: json,
      had_customer_id: !!customerId,
    });

    return NextResponse.json(
      { ok: false, error: "Square booking create failed", details: json, debug_id: debugId },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, booking: json, debug_id: debugId });
}
