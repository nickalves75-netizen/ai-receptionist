export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import s from "../internal.module.css";

function isStaff(user: any): boolean {
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role ?? user?.role ?? "";
  if (typeof role === "string" && ["staff", "admin", "kallr"].includes(role.toLowerCase())) return true;

  const allow = (process.env.KALLR_STAFF_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const email = (user?.email ?? "").toLowerCase();
  if (allow.length && email && allow.includes(email)) return true;

  return false;
}

const PIPELINE = ["new", "qualified", "working", "proposal", "paid", "recurring", "past_due", "closed"];

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hasAssessment(a: any) {
  if (!a || typeof a !== "object") return false;

  const anyLists =
    (Array.isArray(a.find_have) && a.find_have.length) ||
    (Array.isArray(a.find_need) && a.find_need.length) ||
    (Array.isArray(a.lead_have) && a.lead_have.length) ||
    (Array.isArray(a.lead_need) && a.lead_need.length) ||
    (Array.isArray(a.ops_have) && a.ops_have.length) ||
    (Array.isArray(a.ops_need) && a.ops_need.length);

  const anyNotes = (a.find_notes || a.lead_notes || a.ops_notes || a.final_notes) ? true : false;
  return Boolean(anyLists || anyNotes);
}

export default async function OverviewPage() {
  const supabase = await createSupabaseServer();

  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) redirect("/internal/login");

  const { data: u } = await supabase.auth.getUser();
  if (!isStaff(u.user)) redirect("/");

  const { data: leads } = await supabase
    .from("leads")
    .select("id, created_at, stage, deal_value, mrr, probability, assessment")
    .order("created_at", { ascending: false })
    .limit(2000);

  const rows = leads ?? [];

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const total = rows.length;
  const new24h = rows.filter((r: any) => now - new Date(r.created_at).getTime() <= dayMs).length;
  const new7d = rows.filter((r: any) => now - new Date(r.created_at).getTime() <= 7 * dayMs).length;

  const stageCount: Record<string, number> = Object.fromEntries(PIPELINE.map((k) => [k, 0]));
  let pipelineValue = 0;
  let weightedValue = 0;
  let activeMrr = 0;
  let assessmentsCompleted = 0;

  for (const r of rows as any[]) {
    const stage = String(r.stage || "new").toLowerCase();
    if (stageCount[stage] !== undefined) stageCount[stage]++;

    const dv = safeNum(r.deal_value);
    const mrr = safeNum(r.mrr);
    const prob = Math.max(0, Math.min(100, safeNum(r.probability)));

    if (stage !== "closed") pipelineValue += dv;
    if (stage !== "closed") weightedValue += dv * (prob / 100);
    if (stage === "recurring" || stage === "paid") activeMrr += mrr;

    if (hasAssessment(r.assessment)) assessmentsCompleted++;
  }

  const openPipeline = total - (stageCount.closed || 0);

  const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;

  return (
    <div className={s.page}>
      <h1 className={s.h1}>Overview</h1>
      <div className={s.sub}>Key numbers that matter day-to-day inside NEAIS.</div>

      <div className={s.kpis}>
        <KPI label="Total Leads" value={total} />
        <KPI label="New (24h)" value={new24h} />
        <KPI label="New (7d)" value={new7d} />
        <KPI label="Open Pipeline" value={openPipeline} />

        <KPI label="Assessments Completed" value={`${assessmentsCompleted} / ${total}`} />
        <KPI label="Pipeline Value (Setup)" value={fmtMoney(pipelineValue)} />
        <KPI label="Expected Value (Weighted)" value={fmtMoney(weightedValue)} />
        <KPI label="Active MRR" value={fmtMoney(activeMrr)} />
      </div>

      <div className={s.gradientPanel}>
        <div className={s.panelInner}>
          <div style={{ fontWeight: 980, color: "var(--k-text)" }}>Pipeline Snapshot</div>

          <div
            className={s.kpis}
            style={{ marginTop: 12, gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}
          >
            <KPI label="New" value={stageCount.new || 0} />
            <KPI label="Qualified" value={stageCount.qualified || 0} />
            <KPI label="Working" value={stageCount.working || 0} />
            <KPI label="Proposal" value={stageCount.proposal || 0} />

            <KPI label="Paid" value={stageCount.paid || 0} />
            <KPI label="Recurring" value={stageCount.recurring || 0} />
            <KPI label="Past Due" value={stageCount.past_due || 0} />
            <KPI label="Closed" value={stageCount.closed || 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: any }) {
  return (
    <div className={s.kpi}>
      <div className={s.kpiLabel}>{label}</div>
      <div className={s.kpiValue}>{value}</div>
    </div>
  );
}
