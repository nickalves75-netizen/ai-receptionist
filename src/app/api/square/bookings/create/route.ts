// src/app/api/square/bookings/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logApiEvent } from "@/lib/apiEventLog";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const SQUARE_VERSION = process.env.SQUARE_VERSION || "2025-01-23";

type CustomerBody = {
  first_name: string;
  last_name?: string;
  phone?: string; // user may say "508..." etc
  email?: string; // may come in messy ("nick@gmail.com." / "nick at gmail")
};

type Segment = {
  duration_minutes: number;
  team_member_id: string;
  service_variation_id: string;
  service_variation_version: number;
};

type Body = {
  client_id: string;
  start_at: string; // requested start time (ISO)
  location_id?: string;

  // Vapi UI workaround: we allow OBJECT or ARRAY or JSON STRING
  appointment_segments?: Segment[] | Segment | string;
  availability_segments?: Segment[] | Segment | string;

  customer: CustomerBody | string; // allow stringified JSON too
  notes?: string;

  // optional: to make booking deterministic
  team_member_id?: string;
};

function safeJsonParse<T = any>(v: any): T | null {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

function extractEmail(raw: string) {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "";
  // Pull first email-looking substring
  const m = s.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : "";
}

function normalizePhone(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "";

  // If already E.164-ish
  if (s.startsWith("+")) {
    const p = s.replace(/[^\d+]/g, "");
    if (/^\+\d{7,15}$/.test(p)) return p;
    return "";
  }

  // Strip to digits
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";

  // US assumptions (your business is MA / US)
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // Otherwise we refuse (avoid sending junk to Square)
  return "";
}

function normalizeSegments(input: any): Segment[] | null {
  if (!input) return null;

  if (typeof input === "string") {
    const parsed = safeJsonParse<any>(input);
    if (parsed) return normalizeSegments(parsed);
    return null;
  }

  if (!Array.isArray(input) && typeof input === "object") {
    return [input as Segment];
  }

  if (Array.isArray(input)) {
    return input as Segment[];
  }

  return null;
}

function nowPlusMinutesIso(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function addMinutesIso(iso: string, minutes: number) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return nowPlusMinutesIso(minutes);
  return new Date(d.getTime() + minutes * 60 * 1000).toISOString();
}

async function squareAvailabilitySearch(params: {
  accessToken: string;
  locationId: string;
  startAt: string;
  endAt: string;
  segmentFilters: { service_variation_id: string }[];
  teamMemberId?: string;
}) {
  const { accessToken, locationId, startAt, endAt, segmentFilters, teamMemberId } = params;

  const payload: any = {
    query: {
      filter: {
        location_id: locationId,
        start_at_range: { start_at: startAt, end_at: endAt },
        segment_filters: segmentFilters,
      },
    },
  };

  if (teamMemberId) {
    payload.query.filter.bookable_time_filters = [{ team_member_id: teamMemberId }];
  }

  const res = await fetch("https://connect.squareup.com/v2/bookings/availability/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json, payload };
}

async function findOrCreateSquareCustomer(params: {
  accessToken: string;
  customer: CustomerBody;
}) {
  const { accessToken, customer } = params;

  const first = (customer.first_name || "").trim();
  const last = (customer.last_name || "").trim();
  const email = extractEmail(customer.email || "");
  const phone = normalizePhone(customer.phone || "");

  // Re-use an existing customer only if BOTH email + phone are valid and match
  if (email && phone) {
    const searchPayload = {
      query: {
        filter: {
          email_address: { exact: email },
          phone_number: { exact: phone },
        },
      },
      limit: 1,
    };

    const searchResp = await fetch("https://connect.squareup.com/v2/customers/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": SQUARE_VERSION,
      },
      body: JSON.stringify(searchPayload),
    });

    const searchJson = await searchResp.json().catch(() => null);
    const found = searchJson?.customers?.[0]?.id;
    if (searchResp.ok && found) return { id: found as string, mode: "found", detail: searchJson };
    // If search fails, we’ll still try to create — but keep the info for debugging
  }

  // Build create payload WITHOUT empty strings (Square can reject blank fields)
  const createBody: any = {};
  if (first) createBody.given_name = first;
  if (last) createBody.family_name = last;
  if (email) createBody.email_address = email;
  if (phone) createBody.phone_number = phone;

  const createResp = await fetch("https://connect.squareup.com/v2/customers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: JSON.stringify(createBody),
  });

  const createJson = await createResp.json().catch(() => null);
  const id = createJson?.customer?.id;

  if (!createResp.ok || !id) {
    return {
      id: null,
      mode: "create_failed",
      detail: {
        status: createResp.status,
        request: createBody,
        response: createJson,
      },
    };
  }

  return { id: id as string, mode: "created", detail: createJson };
}

export async function POST(req: Request) {
  const debugId =
    (globalThis as any)?.crypto?.randomUUID?.() ||
    `bk_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const body = (await req.json().catch(() => null)) as Body | null;

  // Log incoming request summary (no secrets)
  await logApiEvent({
    route: "square.booking_create",
    client_id: body?.client_id,
    ok: undefined,
    debug_id: debugId,
    request: {
      start_at: body?.start_at,
      location_id: body?.location_id,
      team_member_id: body?.team_member_id,
      has_appointment_segments: !!body?.appointment_segments,
      has_availability_segments: !!body?.availability_segments,
      customer_present: !!body?.customer,
    },
  });

  // Customer may arrive stringified from Vapi
  let customerObj: CustomerBody | null = null;
  if (body?.customer && typeof body.customer === "object") customerObj = body.customer as CustomerBody;
  if (body?.customer && typeof body.customer === "string") customerObj = safeJsonParse<CustomerBody>(body.customer) || null;

  if (!body?.client_id || !body?.start_at || !customerObj?.first_name) {
    await logApiEvent({
      route: "square.booking_create",
      client_id: body?.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 400,
      response: { error: "Missing required fields" },
    });

    return NextResponse.json(
      { ok: false, error: "Missing required fields", debug_id: debugId },
      { status: 400 }
    );
  }

  const segments =
    normalizeSegments(body.appointment_segments) ||
    normalizeSegments(body.availability_segments);

  if (!segments || segments.length === 0) {
    await logApiEvent({
      route: "square.booking_create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 400,
      response: { error: "Must provide appointment_segments or availability_segments" },
    });

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
    await logApiEvent({
      route: "square.booking_create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 400,
      response: { error: "Client missing Square connection", details: clientErr },
    });

    return NextResponse.json(
      { ok: false, error: "Client missing Square connection", details: clientErr, debug_id: debugId },
      { status: 400 }
    );
  }

  const locationId = (body.location_id || client.square_location_id || "").trim();
  if (!locationId) {
    await logApiEvent({
      route: "square.booking_create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 400,
      response: { error: "Missing location_id" },
    });

    return NextResponse.json({ ok: false, error: "Missing location_id", debug_id: debugId }, { status: 400 });
  }

  // --- Availability-locking ---
  const requested = new Date(body.start_at);
  const requestedIso = Number.isNaN(requested.getTime()) ? nowPlusMinutesIso(10) : requested.toISOString();

  const windowStart = new Date(
    Math.max(new Date(addMinutesIso(requestedIso, -30)).getTime(), Date.now() + 5 * 60 * 1000)
  ).toISOString();

  const windowEnd = addMinutesIso(windowStart, 8 * 60);

  // IMPORTANT: never send blank variation ids
  const segmentFilters = segments
    .map((s) => String(s?.service_variation_id || "").trim())
    .filter(Boolean)
    .map((id) => ({ service_variation_id: id }));

  if (segmentFilters.length === 0) {
    await logApiEvent({
      route: "square.booking_create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 400,
      response: { error: "No valid service_variation_id in appointment_segments" },
    });

    return NextResponse.json(
      { ok: false, error: "No valid service_variation_id in appointment_segments", debug_id: debugId },
      { status: 400 }
    );
  }

  const availAttempt = await squareAvailabilitySearch({
    accessToken: client.square_access_token,
    locationId,
    startAt: windowStart,
    endAt: windowEnd,
    segmentFilters,
    teamMemberId: body.team_member_id,
  });

  if (!availAttempt.ok) {
    await logApiEvent({
      route: "square.booking_create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 500,
      response: { error: "Square availability failed", details: availAttempt.json },
    });

    return NextResponse.json(
      { ok: false, error: "Square availability failed", details: availAttempt.json, debug_id: debugId },
      { status: 500 }
    );
  }

  const slots: any[] = Array.isArray(availAttempt.json?.availabilities) ? availAttempt.json.availabilities : [];
  if (slots.length === 0) {
    await logApiEvent({
      route: "square.booking_create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 409,
      response: { error: "No availability near requested time", windowStart, windowEnd },
    });

    return NextResponse.json(
      { ok: false, error: "No availability near requested time", details: { windowStart, windowEnd }, debug_id: debugId },
      { status: 409 }
    );
  }

  let chosen = slots.find((s) => s?.start_at === requestedIso);
  if (!chosen) {
    const reqMs = new Date(requestedIso).getTime();
    const sorted = slots
      .filter((s) => s?.start_at)
      .slice()
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    chosen = sorted.find((s) => new Date(s.start_at).getTime() >= reqMs) || sorted[0];
  }

  const chosenSegments = chosen?.appointment_segments;
  if (!chosen?.start_at || !chosenSegments) {
    await logApiEvent({
      route: "square.booking_create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 500,
      response: { error: "Square returned invalid availability slot", chosen },
    });

    return NextResponse.json(
      { ok: false, error: "Square returned invalid availability slot", details: chosen, debug_id: debugId },
      { status: 500 }
    );
  }

  // Create/find Square customer (now returns real failure details)
  const customerResult = await findOrCreateSquareCustomer({
    accessToken: client.square_access_token,
    customer: customerObj,
  });

  if (!customerResult.id) {
    await logApiEvent({
      route: "square.booking_create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 500,
      response: { error: "Failed to create/find Square customer", details: customerResult.detail },
    });

    return NextResponse.json(
      { ok: false, error: "Failed to create/find Square customer", details: customerResult.detail, debug_id: debugId },
      { status: 500 }
    );
  }

  const idempotencyKey =
    (globalThis as any)?.crypto?.randomUUID?.() || `kallr_${Date.now()}_${Math.random()}`;

  const payload: any = {
    idempotency_key: idempotencyKey,
    booking: {
      start_at: chosen.start_at,
      location_id: chosen.location_id || locationId,
      customer_id: customerResult.id,
      appointment_segments: chosenSegments,
      customer_note: (body.notes || "").trim() || undefined,
    },
  };

  const res = await fetch("https://connect.squareup.com/v2/bookings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.square_access_token}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    await logApiEvent({
      route: "square.booking_create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 500,
      response: { error: "Square booking create failed", details: json },
    });

    return NextResponse.json(
      { ok: false, error: "Square booking create failed", details: json, debug_id: debugId },
      { status: 500 }
    );
  }

  await logApiEvent({
    route: "square.booking_create",
    client_id: body.client_id,
    ok: true,
    debug_id: debugId,
    status_code: 200,
    response: { ok: true },
  });

  return NextResponse.json({ ok: true, booking: json, debug_id: debugId });
}