import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function outcomeLabelFromBooleans(r: any): string {
  if (!r) return "other";
  if (r.booked === true) return "booked";
  if (r.transferred === true) return "transferred";
  if (r.lead_captured === true) return "lead_captured";
  return "info_only";
}

function findOutcomeResult(structuredOutputs: any) {
  if (!structuredOutputs || typeof structuredOutputs !== "object") return null;

  const acceptedNames = new Set(["NEAIS Call Outcome (v1)", "NEAIS Call Outcome (v1)"]);

  for (const k of Object.keys(structuredOutputs)) {
    const item = (structuredOutputs as any)[k];
    if (item?.name && acceptedNames.has(String(item.name))) {
      return item?.result ?? null;
    }
  }
  return null;
}

export async function GET() {
  // 1) Auth check (cookie-based)
  const supabase = await createSupabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2) Securely determine business_id via membership
  // Prefer RLS membership if available; fallback to admin lookup
  let businessId: string | null = null;

  const { data: membershipRls } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userRes.user.id)
    .limit(1)
    .maybeSingle();

  if (membershipRls?.business_id) {
    businessId = String(membershipRls.business_id);
  } else {
    const { data: membership, error: memErr } = await supabaseAdmin
      .from("business_users")
      .select("business_id")
      .eq("user_id", userRes.user.id)
      .limit(1)
      .maybeSingle();

    if (memErr) {
      return NextResponse.json({ error: "db_error", detail: memErr.message }, { status: 500 });
    }
    if (membership?.business_id) businessId = String(membership.business_id);
  }

  if (!businessId) {
    return NextResponse.json({ error: "no_business" }, { status: 403 });
  }

  // 3) Pull latest calls
  const { data: calls, error: callsErr } = await supabaseAdmin
    .from("calls")
    .select("id, status, from_number, to_number, started_at, ended_at, collected_data")
    .eq("business_id", businessId)
    .order("started_at", { ascending: false })
    .limit(25);

  if (callsErr) {
    return NextResponse.json({ error: "db_error", detail: callsErr.message }, { status: 500 });
  }

  // 4) Map into UI-friendly rows
  const rows = (calls || []).map((c: any) => {
    const so = c.collected_data?.structured_outputs;
    const r = findOutcomeResult(so);

    const outcome = outcomeLabelFromBooleans(r);
    const durationSeconds =
      c.started_at && c.ended_at
        ? Math.max(0, Math.round((new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000))
        : null;

    return {
      id: c.id,
      started_at: c.started_at ?? null,
      status: c.status ?? null,
      from_number: c.from_number ?? null,
      to_number: c.to_number ?? null,
      duration_seconds: durationSeconds,
      outcome,
      call_reason: r?.call_reason ?? null,
      notes: r?.notes ?? null,
      lead_captured: r?.lead_captured ?? false,
      transferred: r?.transferred ?? false,
      booked: r?.booked ?? false,
    };
  });

  return NextResponse.json({ rows });
}
