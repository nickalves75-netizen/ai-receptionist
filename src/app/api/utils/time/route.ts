// src/app/api/utils/time/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type Body = {
  client_id: string;
  // ISO timestamps (Square gives UTC "Z")
  times: string[];
  // optional override (rare)
  timezone?: string;
};

function formatForVoice(iso: string, timeZone: string) {
  const d = new Date(iso);

  // e.g. "Sat, Jan 3"
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);

  // e.g. "12:00 PM"
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);

  // e.g. "Saturday, January 3 at 12:00 PM"
  const longLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);

  return { iso, dateLabel, timeLabel, longLabel: `${longLabel} at ${timeLabel}`, timeZone };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.client_id || !Array.isArray(body?.times)) {
      return NextResponse.json({ ok: false, error: "Missing client_id or times[]" }, { status: 400 });
    }

    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });

    let tz = body.timezone;

    if (!tz) {
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .select("timezone")
        .eq("id", body.client_id)
        .single();

      if (clientErr) {
        return NextResponse.json({ ok: false, error: "Client lookup failed", details: clientErr }, { status: 400 });
      }
      tz = client?.timezone || "America/New_York";
    }

    const unique = Array.from(new Set(body.times.filter((t) => typeof t === "string" && t.length > 0)));

    const formatted = unique.map((t) => formatForVoice(t, tz!));

    return NextResponse.json({ ok: true, timezone: tz, formatted });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
