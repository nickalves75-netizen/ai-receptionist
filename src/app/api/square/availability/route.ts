// src/app/api/square/availability/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function requireSecret(req: NextRequest) {
  const expected = process.env.VAPI_TOOL_SECRET;
  if (!expected) return true; // allows calls if unset (not recommended)
  const got =
    req.headers.get("x-kallr-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return got === expected;
}

function jsonError(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

const DEFAULT_TIMEZONE = "America/New_York";

// Keep it simple + predictable (so Vapi stops “thinking” too long)
const DEFAULT_MAX_OPTIONS = 6;
const DEFAULT_BUSINESS_START_HOUR = 9; // 9 AM ET
const DEFAULT_BUSINESS_END_HOUR = 18; // 6 PM ET (end exclusive)

type SlotOption = {
  // what to BOOK
  start_at_utc: string;
  location_id: string;
  appointment_segments: Array<{
    duration_minutes: number;
    team_member_id: string;
    service_variation_id: string;
    service_variation_version?: number;
  }>;

  // what to SPEAK
  display_et: string;

  // helpful extras
  epoch_ms: number;
  team_member_id: string;
  duration_minutes: number;
  service_variation_id: string;
};

function safeInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toEtParts(date: Date, tz = DEFAULT_TIMEZONE) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const weekday = get("weekday");
  const month = get("month");
  const day = get("day"); // numeric string
  const hourStr = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod"); // AM/PM

  const hour12 = safeInt(hourStr, 0);
  let hour24 = hour12;
  if (dayPeriod === "PM" && hour12 !== 12) hour24 = hour12 + 12;
  if (dayPeriod === "AM" && hour12 === 12) hour24 = 0;

  const d = safeInt(day, 0);
  const suffix =
    d % 100 >= 11 && d % 100 <= 13
      ? "th"
      : d % 10 === 1
      ? "st"
      : d % 10 === 2
      ? "nd"
      : d % 10 === 3
      ? "rd"
      : "th";

  const display = `${weekday}, ${month} ${d}${suffix} at ${hour12}:${minute} ${dayPeriod} Eastern`;

  return { display, hour24 };
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message:
        "POST { service_variation_ids: [..] } to search Square availability. Returns SMALL options[] already converted to Eastern time. Use options[i].start_at_utc for booking.",
      expects: {
        service_variation_ids: ["<base_id>", "<addon_id_optional>"],
        timezone: "America/New_York",
        max_options: 6,
        business_hours: { start_hour: 9, end_hour: 18 },
      },
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  if (!requireSecret(req)) {
    return jsonError(401, { ok: false, error: "Unauthorized" });
  }

  const debug_id = crypto.randomUUID();

  const token = process.env.SQUARE_ACCESS_TOKEN;
  const location_id = process.env.SQUARE_LOCATION_ID;

  if (!token) return jsonError(500, { ok: false, error: "Missing SQUARE_ACCESS_TOKEN", debug_id });
  if (!location_id) return jsonError(500, { ok: false, error: "Missing SQUARE_LOCATION_ID", debug_id });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonError(400, { ok: false, error: "Invalid JSON", debug_id });
  }

  const ids = body?.service_variation_ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((x: any) => typeof x !== "string" || !x.trim())) {
    return jsonError(400, {
      ok: false,
      error: "service_variation_ids must be a non-empty array of strings",
      debug_id,
    });
  }

  const tz =
    typeof body?.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : DEFAULT_TIMEZONE;

  const maxOptions = Math.max(1, Math.min(10, safeInt(body?.max_options, DEFAULT_MAX_OPTIONS)));

  const bhStart = Math.max(0, Math.min(23, safeInt(body?.business_hours?.start_hour, DEFAULT_BUSINESS_START_HOUR)));
  const bhEnd = Math.max(0, Math.min(24, safeInt(body?.business_hours?.end_hour, DEFAULT_BUSINESS_END_HOUR)));

  // Always search from "now" forward (do NOT trust tool-provided dates).
  const now = new Date();
  const baseStart = new Date(now.getTime() + 5 * 60 * 1000); // +5 minutes buffer

  const WINDOW_DAYS = 14;
  const MAX_DAYS_AHEAD = 90; // auto-search up to ~3 months out
  const maxEnd = new Date(baseStart.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000);

  let attempt = 0;
  let lastError: any = null;

  while (true) {
    const start = new Date(baseStart.getTime() + attempt * WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

    if (start >= maxEnd) break;
    if (end > maxEnd) end.setTime(maxEnd.getTime());

    const payload = {
      query: {
        filter: {
          location_id,
          start_at_range: {
            start_at: start.toISOString(),
            end_at: end.toISOString(),
          },
          segment_filters:
            ids.length > 1
              ? ids.map((sid: string) => ({ service_variation_id: sid }))
              : [{ service_variation_id: ids[0] }],
        },
      },
    };

    const res = await fetch("https://connect.squareup.com/v2/bookings/availability/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const square_trace_id =
      res.headers.get("square-trace-id") || res.headers.get("x-request-id") || undefined;

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      lastError = {
        ok: false,
        error: `Square API error (${res.status})`,
        debug_id,
        square_trace_id,
        square_errors: json?.errors,
        meta: {
          used_location_id: location_id,
          used_start_at: start.toISOString(),
          used_end_at: end.toISOString(),
          used_service_variation_ids: ids,
          attempt_window_index: attempt,
        },
      };
      break;
    }

    const av = Array.isArray(json?.availabilities) ? json.availabilities : [];

    // Convert to SMALL options[] (ET display + business-hours filter)
    const options: SlotOption[] = [];
    for (const slot of av) {
      const startUtc = typeof slot?.start_at === "string" ? slot.start_at : "";
      if (!startUtc) continue;

      const dt = new Date(startUtc);
      if (isNaN(dt.getTime())) continue;

      const et = toEtParts(dt, tz);

      // business-hours filter (ET local clock) - end is exclusive [start, end)
      if (!(et.hour24 >= bhStart && et.hour24 < bhEnd)) continue;

      const seg = Array.isArray(slot?.appointment_segments) ? slot.appointment_segments[0] : null;
      if (!seg) continue;

      const duration = safeInt(seg?.duration_minutes, 0);
      const tm = typeof seg?.team_member_id === "string" ? seg.team_member_id : "";
      const sid = typeof seg?.service_variation_id === "string" ? seg.service_variation_id : "";

      if (!duration || !tm || !sid) continue;

      options.push({
        start_at_utc: startUtc,
        display_et: et.display,
        epoch_ms: dt.getTime(),
        location_id: slot.location_id || location_id,
        appointment_segments: [
          {
            duration_minutes: duration,
            team_member_id: tm,
            service_variation_id: sid,
            service_variation_version:
              typeof seg?.service_variation_version === "number" ? seg.service_variation_version : undefined,
          },
        ],
        team_member_id: tm,
        duration_minutes: duration,
        service_variation_id: sid,
      });
    }

    options.sort((a, b) => a.epoch_ms - b.epoch_ms);
    const trimmed = options.slice(0, maxOptions);

    if (trimmed.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          debug_id,
          square_trace_id,
          timezone: tz,
          max_options: maxOptions,
          business_hours: { start_hour: bhStart, end_hour: bhEnd },
          meta: {
            used_location_id: location_id,
            used_start_at: start.toISOString(),
            used_end_at: end.toISOString(),
            used_service_variation_ids: ids,
            attempt_window_index: attempt,
            raw_availabilities_count: av.length,
          },
          options: trimmed,
        },
        { status: 200 }
      );
    }

    attempt += 1;
  }

  if (lastError) return NextResponse.json(lastError, { status: 502 });

  return NextResponse.json(
    {
      ok: true,
      debug_id,
      timezone: tz,
      max_options: maxOptions,
      business_hours: { start_hour: bhStart, end_hour: bhEnd },
      options: [],
      meta: {
        used_location_id: location_id,
        used_start_at: baseStart.toISOString(),
        used_end_at: maxEnd.toISOString(),
        used_service_variation_ids: ids,
        note: `No availability found (or none within business hours) in the next ${MAX_DAYS_AHEAD} days.`,
      },
    },
    { status: 200 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
