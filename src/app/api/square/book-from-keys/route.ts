// src/app/api/square/book-from-keys/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function asArray(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

type Body = {
  client_id: string;

  // what to book
  package_key: string; // e.g. "platinum_detail"
  vehicle_tier: "coupe_sedan" | "suv_truck";
  addon_keys?: string[]; // e.g. ["pet_hair","travel_fees"]

  // when to search
  start_at: string; // ISO / RFC3339
  end_at: string; // ISO / RFC3339

  // customer
  customer: {
    given_name: string;
    family_name?: string;
    phone_number?: string;
    email_address?: string;
  };

  // optional preferences
  preferred_start_at?: string;
  team_member_id?: string;

  customer_note?: string;

  dry_run?: boolean;
};

function safeUUID() {
  return (globalThis as any)?.crypto?.randomUUID?.() || `kallr_${Date.now()}_${Math.random()}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (
      !body?.client_id ||
      !body?.package_key ||
      !body?.vehicle_tier ||
      !body?.start_at ||
      !body?.end_at ||
      !body?.customer?.given_name
    ) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: "Server missing Supabase config" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // Load Square creds
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

    // Load service map
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

    const baseVarId =
      map?.base_packages?.[body.package_key]?.tiers?.[body.vehicle_tier]?.service_variation_id || null;

    if (!baseVarId) {
      return NextResponse.json(
        { ok: false, error: `Unknown package_key/tier: ${body.package_key}/${body.vehicle_tier}` },
        { status: 400 }
      );
    }

    const variationIds: string[] = [baseVarId];

    const addonKeys = asArray(body.addon_keys);
    for (const k of addonKeys) {
      const addonId = map?.addons?.[k]?.service_variation_id;
      if (addonId) variationIds.push(addonId);
    }

    // 1) Availability search
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

    const availRes = await fetch("https://connect.squareup.com/v2/bookings/availability/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${client.square_access_token}`,
        "Content-Type": "application/json",
        "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
      },
      body: JSON.stringify(payload),
    });

    const availJson = await availRes.json().catch(() => ({}));
    if (!availRes.ok) {
      return NextResponse.json(
        { ok: false, error: "Square availability failed", details: availJson },
        { status: 500 }
      );
    }

    const slots: any[] = Array.isArray((availJson as any)?.availabilities) ? (availJson as any).availabilities : [];

    if (slots.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No availability",
        availability: { availabilities: [] },
      });
    }

    // If dry_run, return first 10 slots (for voice options)
    if (body.dry_run) {
      const tz = (client as any)?.timezone || "America/New_York";

      const fmt = (iso: string) => {
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
      };

      return NextResponse.json({
        ok: true,
        dry_run: true,
        timezone: tz,
        slots: slots.slice(0, 10).map((s) => ({
          start_at: s.start_at,
          start_at_local: fmt(s.start_at),
          location_id: s.location_id,
          appointment_segments: s.appointment_segments,
        })),
      });
    }

    // Choose slot
    let chosen = slots[0];
    if (body.preferred_start_at) {
      const match = slots.find((s) => s?.start_at === body.preferred_start_at);
      if (match) chosen = match;
    }

    // 2) Create Square customer
    const createCustomerRes = await fetch("https://connect.squareup.com/v2/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${client.square_access_token}`,
        "Content-Type": "application/json",
        "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
      },
      body: JSON.stringify({
        given_name: body.customer.given_name,
        family_name: body.customer.family_name || undefined,
        email_address: body.customer.email_address || undefined,
        phone_number: body.customer.phone_number || undefined,
      }),
    });

    const createCustomerJson = await createCustomerRes.json().catch(() => ({}));
    if (!createCustomerRes.ok) {
      console.error("Square customer create failed:", createCustomerJson);
      return NextResponse.json(
        { ok: false, error: "Square customer create failed", details: createCustomerJson },
        { status: 500 }
      );
    }

    const customerId = (createCustomerJson as any)?.customer?.id as string | undefined;
    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "Square returned no customer id", details: createCustomerJson },
        { status: 500 }
      );
    }

    // 3) Create booking using availability-returned segments
    const bookingPayload: any = {
      idempotency_key: safeUUID(),
      booking: {
        location_id: chosen.location_id || client.square_location_id,
        start_at: chosen.start_at,
        customer_id: customerId,
        appointment_segments: chosen.appointment_segments,
        customer_note: body.customer_note || undefined,
      },
    };

    const bookingRes = await fetch("https://connect.squareup.com/v2/bookings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${client.square_access_token}`,
        "Content-Type": "application/json",
        "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
      },
      body: JSON.stringify(bookingPayload),
    });

    const bookingJson = await bookingRes.json().catch(() => ({}));
    if (!bookingRes.ok) {
      console.error("Square booking create failed:", bookingJson);
      return NextResponse.json(
        { ok: false, error: "Square booking create failed", details: bookingJson },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      chosen_start_at: chosen.start_at,
      booking: bookingJson,
    });
  } catch (e: any) {
    console.error("book-from-keys route crashed:", e);
    return NextResponse.json(
      { ok: false, error: "Server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
