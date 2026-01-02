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

  // MUST be ISO datetime string (e.g. 2026-01-03T15:00:00Z)
  start_at: string;

  // optional; if omitted we will use the client's default Square location_id
  location_id?: string;

  // NEW (preferred): allow Vapi to send variation IDs directly
  // Accepts: string[] OR a JSON string '["id1","id2"]' OR a comma-separated string "id1,id2"
  service_variation_ids?: string[] | string;

  // Backward compat: old callers might still send segments
  appointment_segments?: Segment[] | Segment | string;
  availability_segments?: Segment[] | Segment | string;

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

function stripMs(iso: string) {
  return iso.replace(/\.\d{3}Z$/, "Z");
}

function isValidIsoDateString(s: string) {
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
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

  if (Array.isArray(input)) {
    return input as Segment[];
  }

  return null;
}

function normalizeVariationIds(input: any): string[] {
  if (!input) return [];

  // Already an array
  if (Array.isArray(input)) {
    return input
      .map((x) => String(x ?? "").trim())
      .filter((x) => x.length > 0);
  }

  // String: could be JSON array or comma-separated
  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return [];

    // JSON array string
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed
            .map((x) => String(x ?? "").trim())
            .filter((x) => x.length > 0);
        }
      } catch {
        // fallthrough
      }
    }

    // comma-separated
    return s
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }

  return [];
}

async function findOrCreateSquareCustomer(params: {
  accessToken: string;
  customer: CustomerBody;
}) {
  const { accessToken, customer } = params;

  const rawEmail = (customer.email || "").trim().toLowerCase();
  const email = rawEmail && isValidEmail(rawEmail) ? rawEmail : "";
  const phone = normalizePhone(customer.phone || "");

  // Only re-use an existing Square customer if BOTH email + phone match
  if (email && phone) {
    const searchResp = await fetch(
      "https://connect.squareup.com/v2/customers/search",
      {
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
      }
    );

    const searchJson = await searchResp.json().catch(() => null);
    const found = searchJson?.customers?.[0]?.id;
    if (found) return found;
  }

  // Create customer (only include fields if valid)
  const createResp = await fetch("https://connect.squareup.com/v2/customers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
    },
    body: JSON.stringify({
      given_name: (customer.first_name || "").trim(),
      family_name: (customer.last_name || "").trim() || undefined,
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
  const { accessToken, locationId, startAt, endAt, segmentFilters, teamMemberId } =
    params;

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

  const res = await fetch(
    "https://connect.squareup.com/v2/bookings/availability/search",
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

  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export async function POST(req: Request) {
  const debugId =
    (globalThis as any)?.crypto?.randomUUID?.() ||
    `bk_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const body = (await req.json().catch(() => null)) as Body | null;

  // Hard-validate required fields (no silent fallbacks)
  const firstName = (body?.customer?.first_name || "").trim();
  if (!body?.client_id || !body?.start_at || !firstName) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields", debug_id: debugId },
      { status: 400 }
    );
  }

  if (!isValidIsoDateString(body.start_at)) {
    return NextResponse.json(
      { ok: false, error: "Invalid start_at (must be ISO datetime)", debug_id: debugId },
      { status: 400 }
    );
  }

  // Resolve variation IDs (preferred) OR derive from segments (backward compat)
  let variationIds = normalizeVariationIds(body.service_variation_ids);

  if (variationIds.length === 0) {
    const segments =
      normalizeSegments(body.appointment_segments) ||
      normalizeSegments(body.availability_segments) ||
      null;

    if (segments && segments.length > 0) {
      variationIds = segments
        .map((s) => String(s?.service_variation_id || "").trim())
        .filter((x) => x.length > 0);
    }
  }

  if (variationIds.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing service_variation_ids (or valid appointment_segments)",
        debug_id: debugId,
      },
      { status: 400 }
    );
  }

  const supabase = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("square_access_token,square_location_id")
    .eq("id", body.client_id)
    .single();

  if (clientErr || !client?.square_access_token) {
    return NextResponse.json(
      {
        ok: false,
        error: "Client missing Square connection",
        details: clientErr,
        debug_id: debugId,
      },
      { status: 400 }
    );
  }

  const locationId = (body.location_id || client.square_location_id || "").trim();
  if (!locationId) {
    return NextResponse.json(
      { ok: false, error: "Missing location_id", debug_id: debugId },
      { status: 400 }
    );
  }

  // ---- Availability-locking ----
  // Window: start_at - 30m to start_at + 8h (clamped to future)
  const requestedIso = stripMs(new Date(body.start_at).toISOString());

  const windowStart = new Date(
    Math.max(
      new Date(addMinutesIso(requestedIso, -30)).getTime(),
      Date.now() + 5 * 60 * 1000
    )
  ).toISOString();

  const windowEnd = addMinutesIso(windowStart, 8 * 60);

  const segmentFilters = variationIds
    .map((id) => String(id || "").trim())
    .filter((id) => id.length > 0)
    .map((id) => ({ service_variation_id: id }));

  if (segmentFilters.length === 0) {
    return NextResponse.json(
      { ok: false, error: "service_variation_ids contained no valid ids", debug_id: debugId },
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
    return NextResponse.json(
      { ok: false, error: "Square availability failed", details: availAttempt.json, debug_id: debugId },
      { status: 500 }
    );
  }

  const slots: any[] = Array.isArray(availAttempt.json?.availabilities)
    ? availAttempt.json.availabilities
    : [];

  if (slots.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No availability near requested time",
        details: { windowStart, windowEnd },
        debug_id: debugId,
      },
      { status: 409 }
    );
  }

  // Prefer exact start_at match (ignoring milliseconds), else soonest after requested.
  let chosen = slots.find((s) => stripMs(String(s?.start_at || "")) === requestedIso);

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
    return NextResponse.json(
      { ok: false, error: "Square returned invalid availability slot", details: chosen, debug_id: debugId },
      { status: 500 }
    );
  }

  // Create/find Square customer
  const customerId = await findOrCreateSquareCustomer({
    accessToken: client.square_access_token,
    customer: {
      ...body.customer,
      first_name: firstName,
    },
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
      start_at: chosen.start_at,
      location_id: chosen.location_id || locationId,
      customer_id: customerId,
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
    return NextResponse.json(
      { ok: false, error: "Square booking create failed", details: json, debug_id: debugId },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, booking: json, debug_id: debugId });
}