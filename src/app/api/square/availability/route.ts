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

  // date range
  start_at: string;
  end_at: string;

  /**
   * Option A (preferred): pass package_key + vehicle_tier and optional addon_keys.
   * Kallr uses the per-client service map from DB to look up variation IDs.
   */
  package_key?: string; // e.g. "platinum_detail"
  vehicle_tier?: "coupe_sedan" | "suv_truck";
  addon_keys?: string[]; // e.g. ["pet_hair","travel_fees"]

  /**
   * Option B (fallback): directly pass variation ids (what we used for testing).
   */
  service_variation_ids?: string[];

  // optional
  team_member_id?: string;
};

function asArray(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

/**
 * If start_at comes in as "past" (timezone/parsing), Square rejects.
 * Fix: clamp start_at to now + small buffer.
 */
function clampStartAtToFuture(startAtIso: string, minutesAhead = 5) {
  const d = new Date(startAtIso);
  if (Number.isNaN(d.getTime())) return startAtIso;

  const min = Date.now() + minutesAhead * 60 * 1000;
  if (d.getTime() < min) return new Date(min).toISOString();

  return d.toISOString();
}

/**
 * Preserve the caller’s intended window length:
 * - Compute original window = (endOrig - startOrig)
 * - If we clamp start forward, shift end forward by the same window length
 * - Ensure end_at is always after start_at (min 15 minutes)
 */
function shiftEndToPreserveWindow(params: {
  originalStartIso: string;
  originalEndIso: string;
  newStartIso: string;
  minMinutes?: number;
}) {
  const { originalStartIso, originalEndIso, newStartIso, minMinutes = 15 } = params;

  const s0 = new Date(originalStartIso);
  const e0 = new Date(originalEndIso);
  const s1 = new Date(newStartIso);

  const minMs = minMinutes * 60 * 1000;

  if (Number.isNaN(s1.getTime())) return originalEndIso;

  // If originals are invalid, just make a safe end after newStart
  if (Number.isNaN(s0.getTime()) || Number.isNaN(e0.getTime())) {
    return new Date(s1.getTime() + minMs).toISOString();
  }

  let windowMs = e0.getTime() - s0.getTime();

  // If caller gave a bad/zero window, force a small window
  if (!Number.isFinite(windowMs) || windowMs < minMs) windowMs = minMs;

  const newEnd = new Date(s1.getTime() + windowMs);
  return newEnd.toISOString();
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!body?.client_id || !body?.start_at || !body?.end_at) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const originalStart = String(body.start_at);
  const originalEnd = String(body.end_at);

  // ✅ clamp start to future
  const newStart = clampStartAtToFuture(originalStart);

  // ✅ shift end forward to preserve the original window length (and guarantee end > start)
  const newEnd = shiftEndToPreserveWindow({
    originalStartIso: originalStart,
    originalEndIso: originalEnd,
    newStartIso: newStart,
    minMinutes: 15,
  });

  body.start_at = newStart;
  body.end_at = newEnd;

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

  // Determine service variation ids
  let variationIds: string[] = [];

  if (Array.isArray(body.service_variation_ids) && body.service_variation_ids.length > 0) {
    variationIds = body.service_variation_ids;
  } else {
    // Load client service map from DB
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
        {
          ok: false,
          error: "Must provide package_key + vehicle_tier (or service_variation_ids)",
        },
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

  const segmentFilters = variationIds.map((id) => ({ service_variation_id: id }));

  const payload: any = {
    query: {
      filter: {
        location_id: client.square_location_id,
        start_at_range: { start_at: body.start_at, end_at: body.end_at },
        segment_filters: segmentFilters,
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

  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Square availability failed", details: json }, { status: 500 });
  }

  return NextResponse.json({ ok: true, availability: json });
}
