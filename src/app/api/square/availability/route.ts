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

  start_at: string;
  end_at: string;

  package_key?: string;
  vehicle_tier?: "coupe_sedan" | "suv_truck";
  addon_keys?: string[];

  service_variation_ids?: string[];

  team_member_id?: string;
};

function asArray(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function parseIsoStrict(s: string): Date | null {
  if (!s || typeof s !== "string") return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Clamp only if the provided startAt is valid AND actually in the past.
 * If parsing fails, we should NOT "guess" — return 400 so the caller fixes inputs.
 */
function clampStartAtToFutureStrict(startAtIso: string, minutesAhead = 5) {
  const d = parseIsoStrict(startAtIso);
  if (!d) return { ok: false as const, error: "Invalid start_at datetime (must be ISO/RFC3339)" };

  const min = Date.now() + minutesAhead * 60 * 1000;
  if (d.getTime() < min) return { ok: true as const, value: new Date(min).toISOString() };

  return { ok: true as const, value: d.toISOString() };
}

/**
 * Preserve window length while ensuring end > start by at least minMinutes.
 * Requires valid original & newStart; if end invalid, we still make safe end.
 */
function shiftEndToPreserveWindowStrict(params: {
  originalStartIso: string;
  originalEndIso: string;
  newStartIso: string;
  minMinutes?: number;
}) {
  const { originalStartIso, originalEndIso, newStartIso, minMinutes = 15 } = params;

  const s0 = parseIsoStrict(originalStartIso);
  const e0 = parseIsoStrict(originalEndIso);
  const s1 = parseIsoStrict(newStartIso);

  if (!s1) return { ok: false as const, error: "Invalid start_at after clamp" };

  const minMs = minMinutes * 60 * 1000;

  // If original window invalid, create a safe small window
  if (!s0 || !e0) {
    return { ok: true as const, value: new Date(s1.getTime() + minMs).toISOString() };
  }

  let windowMs = e0.getTime() - s0.getTime();
  if (!Number.isFinite(windowMs) || windowMs < minMs) windowMs = minMs;

  return { ok: true as const, value: new Date(s1.getTime() + windowMs).toISOString() };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.client_id || !body?.start_at || !body?.end_at) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  // Validate incoming range first (no silent "fixing" invalid strings)
  const startParsed = parseIsoStrict(String(body.start_at));
  const endParsed = parseIsoStrict(String(body.end_at));
  if (!startParsed) {
    return NextResponse.json({ ok: false, error: "Invalid start_at (must be ISO/RFC3339)" }, { status: 400 });
  }
  if (!endParsed) {
    return NextResponse.json({ ok: false, error: "Invalid end_at (must be ISO/RFC3339)" }, { status: 400 });
  }
  if (endParsed.getTime() <= startParsed.getTime()) {
    return NextResponse.json({ ok: false, error: "end_at must be after start_at" }, { status: 400 });
  }

  const originalStart = String(body.start_at);
  const originalEnd = String(body.end_at);

  const clamped = clampStartAtToFutureStrict(originalStart, 5);
  if (!clamped.ok) {
    return NextResponse.json({ ok: false, error: clamped.error }, { status: 400 });
  }

  const shifted = shiftEndToPreserveWindowStrict({
    originalStartIso: originalStart,
    originalEndIso: originalEnd,
    newStartIso: clamped.value,
    minMinutes: 15,
  });

  if (!shifted.ok) {
    return NextResponse.json({ ok: false, error: shifted.error }, { status: 400 });
  }

  body.start_at = clamped.value;
  body.end_at = shifted.value;

  if (process.env.KALLR_DEBUG_SQUARE === "1") {
    console.info("[square][availability_request]", {
      client_id: body.client_id,
      originalStart,
      originalEnd,
      computedStart: body.start_at,
      computedEnd: body.end_at,
      team_member_id: body.team_member_id || null,
      service_variation_ids: body.service_variation_ids || null,
      package_key: body.package_key || null,
      vehicle_tier: body.vehicle_tier || null,
      addon_keys: body.addon_keys || null,
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

  if (clientErr || !client?.square_access_token || !client?.square_location_id) {
    return NextResponse.json(
      { ok: false, error: "Client missing Square connection", details: clientErr },
      { status: 400 }
    );
  }

  // Determine variation ids
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

    const addonKeys = asArray(body.addon_keys);
    for (const k of addonKeys) {
      const addonId = map?.addons?.[k]?.service_variation_id;
      if (addonId) variationIds.push(addonId);
    }
  }

  if (variationIds.length === 0) {
    return NextResponse.json({ ok: false, error: "No service variation ids resolved" }, { status: 400 });
  }

  const payload: any = {
    query: {
      filter: {
        location_id: client.square_location_id,
        start_at_range: { start_at: body.start_at, end_at: body.end_at },
        segment_filters: variationIds.map((id) => ({ service_variation_id: id })),
      },
    },
  };

  if (body.team_member_id) {
    payload.query.filter.bookable_time_filters = [{ team_member_id: body.team_member_id }];
  }

  const res = await fetch("https://connect.squareup.com/v2/bookings/availability/search", {
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
    return NextResponse.json({ ok: false, error: "Square availability failed", details: json }, { status: 500 });
  }

  return NextResponse.json({ ok: true, availability: json });
}