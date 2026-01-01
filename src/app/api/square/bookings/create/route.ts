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

function maskEmail(email?: string) {
  if (!email) return undefined;
  const [u, d] = email.split("@");
  if (!u || !d) return "***";
  return `${u.slice(0, 2)}***@${d}`;
}

function maskPhone(phone?: string) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

function isEmailInvalidSquareError(details: any): boolean {
  const errs = details?.errors;
  if (!Array.isArray(errs)) return false;
  return errs.some((e: any) => (e?.field || "").toLowerCase() === "email");
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

  // Search using ONE identifier only (email preferred)
  if (email || phone) {
    const searchFilter = email
      ? { email_address: { exact: email } }
      : phone
      ? { phone_number: { exact: phone } }
      : {};

    const { res: searchRes, json: searchJson } = await squareJson(
      "https://connect.squareup.com/v2/customers/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
        },
        body: JSON.stringify({ query: { filter: searchFilter }, limit: 1 }),
      }
    );

    if (searchRes.ok) {
      const found = searchJson?.customers?.[0]?.id;
      if (found) return found as string;
    } else if (process.env.KALLR_DEBUG_SQUARE === "1") {
      console.error("[square][customer_search_failed]", debugId, {
        status: searchRes.status,
        details: searchJson,
      });
    }
  }

  // Create customer
  const base: any = {
    given_name: (customer.first_name || "").trim(),
    family_name: (customer.last_name || "").trim() || undefined,
    phone_number: phone,
  };
  if (email) base.email_address = email;

  const { res: createRes1, json: createJson1 } = await squareJson(
    "https://connect.squareup.com/v2/customers",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
      },
      body: JSON.stringify(base),
    }
  );

  if (createRes1.ok && createJson1?.customer?.id) return createJson1.customer.id as string;

  // If email is the reason, retry without email (this prevents real-call failures)
  if (email && isEmailInvalidSquareError(createJson1)) {
    const retryBody = { ...base };
    delete retryBody.email_address;

    const { res: createRes2, json: createJson2 } = await squareJson(
      "https://connect.squareup.com/v2/customers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
        },
        body: JSON.stringify(retryBody),
      }
    );

    if (process.env.KALLR_DEBUG_SQUARE === "1") {
      console.error("[square][customer_create_email_invalid_retry]", debugId, {
        firstAttempt: createJson1,
        secondStatus: createRes2.status,
        secondAttempt: createJson2,
      });
    }

    if (createRes2.ok && createJson2?.customer?.id) return createJson2.customer.id as string;
  }

  // Full log (only when debug is on)
  if (process.env.KALLR_DEBUG_SQUARE === "1") {
    console.error("[square][customer_create_failed]", debugId, {
      status: createRes1.status,
      details: createJson1,
      sentEmail: !!email,
    });
  }

  return null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;

  const debugId = `bk_${Date.now()}_${Math.random().toString(16).slice(2)}`;

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

  // Safe request log (no tokens; masked PII)
  if (process.env.KALLR_DEBUG_SQUARE === "1") {
    console.info("[square][booking_request]", debugId, {
      client_id: body.client_id,
      start_at: body.start_at,
      location_id: body.location_id || null,
      segments_count: segments.length,
      customer: {
        first_name: body.customer?.first_name,
        last_name: body.customer?.last_name,
        phone: maskPhone(body.customer?.phone),
        email: maskEmail(body.customer?.email),
        email_present: !!(body.customer?.email || "").trim(),
      },
    });
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

  const customerId = await findOrCreateSquareCustomer({
    accessToken: client.square_access_token,
    customer: body.customer,
    debugId,
  });

  if (!customerId) {
    return NextResponse.json(
      { ok: false, error: "Failed to create/find Square customer", debug_id: debugId },
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
    // ✅ This is what you need — prints the full Square error JSON into Vercel logs
    console.error("[square][booking_create_failed]", debugId, {
      status: res.status,
      details: json,
    });

    return NextResponse.json(
      { ok: false, error: "Square booking create failed", details: json, debug_id: debugId },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, booking: json, debug_id: debugId });
}
