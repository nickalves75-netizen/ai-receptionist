import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

function parseDays(url: string) {
  const u = new URL(url);
  const v = u.searchParams.get("days") || "7";
  const n = Number(v);
  if (![1, 7, 30].includes(n)) return 7;
  return n as 1 | 7 | 30;
}

function findOutcomeResult(structuredOutputs: any) {
  if (!structuredOutputs || typeof structuredOutputs !== "object") return null;

  const acceptedNames = new Set(["NEAIS Call Outcome (v1)", "Kallr Call Outcome (v1)"]);

  for (const k of Object.keys(structuredOutputs)) {
    const item = (structuredOutputs as any)[k];
    if (item?.name && acceptedNames.has(String(item.name))) {
      return item?.result ?? null;
    }
  }
  return null;
}

export async function GET(req: Request) {
  // 1) Auth check (cookie-based)
  const supabase = await createSupabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2) Determine business_id via membership (RLS-enforced)
  const { data: membership, error: memErr } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userRes.user.id)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return NextResponse.json({ error: "db_error", detail: memErr.message }, { status: 500 });
  }
  if (!membership?.business_id) {
    return NextResponse.json({ error: "no_business" }, { status: 403 });
  }

  const days = parseDays(req.url);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // 3) Fetch calls for business in timeframe (RLS-enforced)
  const { data: calls, error: callsErr } = await supabase
    .from("calls")
    .select("status, started_at, ended_at, collected_data")
    .eq("business_id", membership.business_id)
    .gte("started_at", since);

  if (callsErr) {
    return NextResponse.json({ error: "db_error", detail: callsErr.message }, { status: 500 });
  }

  // 4) Aggregate metrics
  let total = 0;
  let answered = 0;
  let leads = 0;
  let transfers = 0;
  let bookings = 0;
  let durSumMs = 0;
  let durCt = 0;

  for (const c of calls || []) {
    total += 1;
    if (c.status === "completed" || c.status === "handled") answered += 1;

    const so = (c as any).collected_data?.structured_outputs;
    const r = findOutcomeResult(so);

    if (r?.lead_captured === true) leads += 1;
    if (r?.transferred === true) transfers += 1;
    if (r?.booked === true) bookings += 1;

    if (c.started_at && c.ended_at) {
      const ms = new Date(c.ended_at).getTime() - new Date(c.started_at).getTime();
      if (ms >= 0) {
        durSumMs += ms;
        durCt += 1;
      }
    }
  }

  const avgSeconds = durCt ? Math.round(durSumMs / durCt / 1000) : 0;

  return NextResponse.json({
    business_id: membership.business_id,
    days,
    total_calls: total,
    answered_calls: answered,
    leads_captured: leads,
    transfers,
    bookings,
    avg_duration_seconds: avgSeconds,
  });
}
