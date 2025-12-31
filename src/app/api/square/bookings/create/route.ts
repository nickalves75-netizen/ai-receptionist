// src/app/api/square/bookings/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type CustomerBody = {
  first_name: string;
  last_name?: string;
  phone?: string; // E.164 preferred +1...
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

  // Vapi UI workaround: we allow OBJECT or ARRAY or JSON STRING
  appointment_segments?: Segment[] | Segment | string;
  availability_segments?: Segment[] | Segment | string;

  customer: CustomerBody;
  notes?: string;
};

function normalizeSegments(input: any): Segment[] | null {
  if (!input) return null;

  // If Vapi sends a JSON string
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return normalizeSegments(parsed);
    } catch {
      return null;
    }
  }

  // If Vapi sends a single object
  if (!Array.isArray(input) && typeof input === "object") {
    return [input as Segment];
  }

  // If Vapi sends an array
  if (Array.isArray(input)) {
    return input as Segment[];
  }

  return null;
}

async function findOrCreateSquareCustomer(params: {
  accessToken: string;
  customer: CustomerBody;
}) {
  const { accessToken, customer } = params;

  const email = (customer.email || "").trim();
  const phone = (customer.phone || "").trim();

  // Try search first if we have an identifier
  if (email || phone) {
    const searchResp = await fetch("https://connect.squareup.com/v2/customers/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
      },
      body: JSON.stringify({
        query: {
          filter: {
            ...(email ? { email_address: { exact: email } } : {}),
            ...(phone ? { phone_number: { exact: phone } } : {}),
          },
        },
        limit: 1,
      }),
    });

    const searchJson = await searchResp.json().catch(() => null);
    const found = searchJson?.customers?.[0]?.id;
    if (found) return found;
  }

  // Create customer
  const createResp = await fetch("https://connect.squareup.com/v2/customers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
    },
    body: JSON.stringify({
      given_name: customer.first_name || "",
      family_name: customer.last_name || "",
      email_address: email || undefined,
      phone_number: phone || undefined,
    }),
  });

  const createJson = await createResp.json().catch(() => null);
  const id = createJson?.customer?.id;
  if (!createResp.ok || !id) return null;

  return id as string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.client_id || !body?.start_at || !body?.customer?.first_name) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const segments =
    normalizeSegments(body.appointment_segments) ||
    normalizeSegments(body.availability_segments);

  if (!segments || segments.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Must provide appointment_segments or availability_segments" },
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
      { ok: false, error: "Client missing Square connection", details: clientErr },
      { status: 400 }
    );
  }

  const locationId = (body.location_id || client.square_location_id || "").trim();
  if (!locationId) {
    return NextResponse.json({ ok: false, error: "Missing location_id" }, { status: 400 });
  }

  // Create/find Square customer (so booking is valid)
  const customerId = await findOrCreateSquareCustomer({
    accessToken: client.square_access_token,
    customer: body.customer,
  });

  if (!customerId) {
    return NextResponse.json(
      { ok: false, error: "Failed to create/find Square customer" },
      { status: 500 }
    );
  }

  const idempotencyKey =
    (globalThis as any)?.crypto?.randomUUID?.() || `kallr_${Date.now()}_${Math.random()}`;

  const payload: any = {
    idempotency_key: idempotencyKey,
    booking: {
      start_at: body.start_at,
      location_id: locationId,
      customer_id: customerId,
      appointment_segments: segments,
      customer_note: (body.notes || "").trim() || undefined,
    },
  };

  const res = await fetch("https://connect.squareup.com/v2/bookings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.square_access_token}`,
      "Content-Type": "application/json",
      "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: "Square booking create failed", details: json },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, booking: json });
}
