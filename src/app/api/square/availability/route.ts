// src/app/api/square/availability/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type Body = {
  client_id: string;

  // Caller can pass these, but we will apply sane defaults if they are missing/too wide.
  start_at?: string;
  end_at?: string;

  /**
   * Option A (preferred): pass package_key + vehicle_tier and optional addon_keys.
   */
  package_key?: string;
  vehicle_tier?: "coupe_sedan" | "suv_truck";
  addon_keys?: string[];

  /**
   * Option B (fallback): directly pass variation ids.
   */
  service_variation_ids?: string[];

  // optional
  team_member_id?: string;

  /**
   * Optional guardrail: cap how far ahead we search (default 14 then expand).
   * If provided, we still expand in steps up to this cap.
   */
  max_days_ahead?: number;
};

type SquareAvailability = {
  start_at: string;
  location_id: string;
  appointment_segments: any[];
};

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function clampInt(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function nowPlusMinutesIso(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function addDaysIso(startIso: string, days: number) {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return new Date(Date.now() + days * 86400_000).toISOString();
  return new Date(d.getTime() + days * 86400_000).toISOString();
}

function fmtLocal(iso: string, tz: string) {
  const d = new Date(iso);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return { iso, dateLabel, timeLabel, label: `${dateLabel} at ${timeLabel}` };
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
  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.client_id) {
    return NextResponse.json({ ok: false, error: "Missing client_id" }, { status: 400 });
  }

  // Connect to Supabase
  const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  // Load client Square creds (+ timezone)
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("square_access_token,square_location_id,timezone")
    .eq("id", body.client_id)
    .single();

  if (clientErr || !client?.square_access_token || !client?.square_location_id) {
    return NextResponse.json(
      { ok: false, error: "Client missing Square connection", details: clientErr },
      { status: 400 }
    );
  }

  const tz = (client as any)?.timezone || "America/New_York";

  // Resolve service variation ids
  let variationIds: string[] = [];

  if (Array.isArray(body.service_variation_ids) && body.service_variation_ids.length > 0) {
    variationIds = body.service_variation_ids;
  } else {
    const { data: mapRow, error: mapErr } = await supabase
      .from("client_service_maps")
      .select("map")
      .eq("client_id", body.client_id)
      .single();

    if (mapErr || !mapRow?.map) {
      return NextResponse.json(
        { ok: false, error: "Missing client service map", details: mapErr },
        { status: 400 }
      );
    }

    const map = mapRow.map as any;
    const pkgKey = body.package_key;
    const tier = body.vehicle_tier;

    if (!pkgKey || !tier) {
      return NextResponse.json(
        { ok: false, error: "Must provide package_key + vehicle_tier (or service_variation_ids)" },
        { status: 400 }
      );
    }

    const baseVarId = map?.base_packages?.[pkgKey]?.tiers?.[tier]?.service_variation_id || null;
    if (!baseVarId) {
      return NextResponse.json(
        { ok: false, error: `Unknown package_key/tier: ${pkgKey}/${tier}` },
        { status: 400 }
      );
    }

    variationIds.push(baseVarId);

    for (const k of asArray<string>(body.addon_keys)) {
      const addonId = map?.addons?.[k]?.service_variation_id;
      if (addonId) variationIds.push(addonId);
    }
  }

  if (variationIds.length === 0) {
    return NextResponse.json({ ok: false, error: "No service variation ids resolved" }, { status: 400 });
  }

  const segmentFilters = variationIds.map((id) => ({ service_variation_id: id }));

  // ---- Smart date windows ----
  // Default: start now+5m. Then search 14 days, expand to 30, then 90.
  // If caller provides start/end, we still protect against absurd ranges.
  const startBase = body.start_at ? new Date(body.start_at) : new Date();
  const startAt = Number.isNaN(startBase.getTime()) ? new Date() : startBase;

  // Always ensure start is in the future a bit
  const safeStartIso = new Date(Math.max(startAt.getTime(), Date.now() + 5 * 60 * 1000)).toISOString();

  // Cap expansion based on optional max_days_ahead
  const maxDaysCap = clampInt(body.max_days_ahead ?? 90, 7, 365);

  // If caller provided end_at, compute a requested window but cap it
  let requestedDays = 0;
  if (body.end_at) {
    const endD = new Date(body.end_at);
    if (!Number.isNaN(endD.getTime())) {
      const ms = endD.getTime() - new Date(safeStartIso).getTime();
      requestedDays = Math.ceil(ms / 86400_000);
    }
  }

  // Build window steps
  const steps = [14, 30, 90]
    .map((d) => Math.min(d, maxDaysCap))
    .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i);

  // If caller requested a smaller window, try that first (but not > cap)
  if (requestedDays > 0) {
    const rd = Math.min(Math.max(requestedDays, 1), maxDaysCap);
    steps.unshift(rd);
  }

  let lastErr: any = null;
  let found: SquareAvailability[] = [];

  for (const days of steps) {
    const endIso = addDaysIso(safeStartIso, days);

    const attempt = await squareAvailabilitySearch({
      accessToken: client.square_access_token,
      locationId: client.square_location_id,
      startAt: safeStartIso,
      endAt: endIso,
      segmentFilters,
      teamMemberId: body.team_member_id,
    });

    if (!attempt.ok) {
      lastErr = attempt.json;
      continue;
    }

    const slots: SquareAvailability[] = Array.isArray(attempt.json?.availabilities)
      ? attempt.json.availabilities
      : [];

    if (slots.length > 0) {
      found = slots;
      break;
    }
  }

  if (found.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        availability: { availabilities: [], errors: [] },
        message: "No availability in searched window",
        details: lastErr || null,
      },
      { status: 200 }
    );
  }

  // Return slots + a voice-friendly list (first 10)
  const voiceSlots = found.slice(0, 10).map((s) => ({
    start_at: s.start_at,
    start_at_local: fmtLocal(s.start_at, tz),
    location_id: s.location_id,
    appointment_segments: s.appointment_segments,
  }));

  return NextResponse.json(
    {
      ok: true,
      timezone: tz,
      availability: { availabilities: found, errors: [] },
      slots: voiceSlots,
    },
    { status: 200 }
  );
}