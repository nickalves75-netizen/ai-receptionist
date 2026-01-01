// src/app/api/square/bookings/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logApiEvent } from "@/lib/apiEventLog";

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
  start_at: string; // requested start time (ISO)
  location_id?: string;

  // We accept any of these from the agent, but we DO NOT trust them for final booking.
  appointment_segments?: Segment[] | Segment | string;
  availability_segments?: Segment[] | Segment | string;

  // NEW: preferred re-check input (matches availability flow)
  service_variation_ids?: string[] | string;

  customer: CustomerBody;
  notes?: string;

  // optional: to make booking deterministic
  team_member_id?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone: string) {
  const p = (phone || "").trim();
  if (!p) return "";
  if (!p.startsWith("+")) return "";
  if (!/^\+\d{7,15}$/.test(p)) return "";
  return p;
}

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

  if (!Array.isArray(input) && typeof input === "object") {
    return [input as Segment];
  }

  if (Array.isArray(input)) return input as Segment[];

  return null;
}

function normalizeStringArray(input: any): string[] | null {
  if (!input) return null;

  if (typeof input === "string") {
    // could be a JSON string array OR a single id
    const t = input.trim();
    if (!t) return null;

    if (t.startsWith("[") && t.endsWith("]")) {
      try {
        const parsed = JSON.parse(t);
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : null;
      } catch {
        return null;
      }
    }

    return [t];
  }

  if (Array.isArray(input)) return input.map(String).filter(Boolean);

  return null;
}

async function findOrCreateSquareCustomer(params: { accessToken: string; customer: CustomerBody }) {
  const { accessToken, customer } = params;

  const rawEmail = (customer.email || "").trim().toLowerCase();
  const email = rawEmail && isValidEmail(rawEmail) ? rawEmail : "";
  const phone = normalizePhone(customer.phone || "");

  // Only re-use an existing Square customer if BOTH email + phone match
  if (email && phone) {
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
            email_address: { exact: email },
            phone_number: { exact: phone },
          },
        },
        limit: 1,
      }),
    });

    const searchJson = await searchResp.json().catch(() => null);
    const found = searchJson?.customers?.[0]?.id;
    if (found) return found;
  }

  // Create customer (only include valid fields)
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
      "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export async function POST(req: Request) {
  const debugId =
    (globalThis as any)?.crypto?.randomUUID?.() || `bk_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const body = (await req.json().catch(() => null)) as Body | null;

  await logApiEvent({
    route: "square.bookings.create",
    client_id: body?.client_id,
    ok: undefined,
    debug_id: debugId,
    request: {
      start_at: body?.start_at,
      location_id: body?.location_id,
      service_variation_ids_count: Array.isArray(body?.service_variation_ids)
        ? body?.service_variation_ids.length
        : 0,
      has_appointment_segments: !!body?.appointment_segments,
      has_availability_segments: !!body?.availability_segments,
      team_member_id: body?.team_member_id,
    },
  });

  if (!body?.client_id || !body?.start_at || !body?.customer?.first_name) {
    await logApiEvent({
      route: "square.bookings.create",
      client_id: body?.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 400,
      response: { error: "Missing required fields" },
    });

    return NextResponse.json({ ok: false, error: "Missing required fields", debug_id: debugId }, { status: 400 });
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
      route: "square.bookings.create",
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
      route: "square.bookings.create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 400,
      response: { error: "Missing location_id" },
    });

    return NextResponse.json({ ok: false, error: "Missing location_id", debug_id: debugId }, { status: 400 });
  }

  // We prefer service_variation_ids for re-checks (more reliable than agent-built appointment_segments)
  const serviceVariationIds = normalizeStringArray(body.service_variation_ids);

  // Keep segments optional now; we can book from Square-returned slot segments.
  const segments =
    normalizeSegments(body.appointment_segments) || normalizeSegments(body.availability_segments);

  if ((!serviceVariationIds || serviceVariationIds.length === 0) && (!segments || segments.length === 0)) {
    await logApiEvent({
      route: "square.bookings.create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 400,
      response: { error: "Must provide service_variation_ids or appointment_segments/availability_segments" },
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Must provide service_variation_ids or appointment_segments/availability_segments",
        debug_id: debugId,
      },
      { status: 400 }
    );
  }

  const requested = new Date(body.start_at);
  const requestedIso = Number.isNaN(requested.getTime()) ? nowPlusMinutesIso(10) : requested.toISOString();

  // Re-check window: requested -30m to +8h (clamped to now+5m)
  const windowStart = new Date(
    Math.max(new Date(addMinutesIso(requestedIso, -30)).getTime(), Date.now() + 5 * 60 * 1000)
  ).toISOString();
  const windowEnd = addMinutesIso(windowStart, 8 * 60);

  const segmentFilters =
    serviceVariationIds && serviceVariationIds.length > 0
      ? serviceVariationIds.map((id) => ({ service_variation_id: id }))
      : (segments || []).map((s) => ({ service_variation_id: s.service_variation_id }));

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
      route: "square.bookings.create",
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
      route: "square.bookings.create",
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

  // Prefer exact match; else next soonest after requested
  let chosen = slots.find((s) => s?.start_at === requestedIso);
  if (!chosen) {
    const reqMs = new Date(requestedIso).getTime();
    const sorted = slots
      .filter((s) => s?.start_at)
      .slice()
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    chosen = sorted.find((s) => new Date(s.start_at).getTime() >= reqMs) || sorted[0];
  }

  // Safety: if the chosen slot is too far from the requested time, do NOT silently book wrong.
  const chosenMs = chosen?.start_at ? new Date(chosen.start_at).getTime() : NaN;
  const reqMs = new Date(requestedIso).getTime();
  const deltaMs = Number.isFinite(chosenMs) ? Math.abs(chosenMs - reqMs) : Infinity;

  // If it's more than 2 hours away, force the agent to re-offer options
  if (!chosen?.start_at || deltaMs > 2 * 60 * 60 * 1000) {
    await logApiEvent({
      route: "square.bookings.create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 409,
      response: { error: "Requested slot mismatch", requestedIso, chosenStartAt: chosen?.start_at, deltaMs },
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Requested slot mismatch",
        details: { requestedIso, chosen_start_at: chosen?.start_at },
        debug_id: debugId,
      },
      { status: 409 }
    );
  }

  const chosenSegments = chosen?.appointment_segments;
  if (!chosenSegments) {
    await logApiEvent({
      route: "square.bookings.create",
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

  const customerId = await findOrCreateSquareCustomer({
    accessToken: client.square_access_token,
    customer: body.customer,
  });

  if (!customerId) {
    await logApiEvent({
      route: "square.bookings.create",
      client_id: body.client_id,
      ok: false,
      debug_id: debugId,
      status_code: 500,
      response: { error: "Failed to create/find Square customer" },
    });

    return NextResponse.json({ ok: false, error: "Failed to create/find Square customer", debug_id: debugId }, { status: 500 });
  }

  const idempotencyKey =
    (globalThis as any)?.crypto?.randomUUID?.() || `kallr_${Date.now()}_${Math.random()}`;

  const payload: any = {
    idempotency_key: idempotencyKey,
    booking: {
      start_at: chosen.start_at,
      location_id: chosen.location_id || locationId,
      customer_id: customerId,
      // CRITICAL: always book using Square-returned appointment_segments
      appointment_segments: chosenSegments,
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
    await logApiEvent({
      route: "square.bookings.create",
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
    route: "square.bookings.create",
    client_id: body.client_id,
    ok: true,
    debug_id: debugId,
    status_code: 200,
    response: { ok: true, booking_id: json?.booking?.id || null },
  });

  return NextResponse.json({ ok: true, booking: json, debug_id: debugId });
}