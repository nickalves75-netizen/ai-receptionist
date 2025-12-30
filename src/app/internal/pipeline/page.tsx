export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import PipelineClient from "./pipelineClient";

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

function safe(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function pick(obj: any, paths: string[]) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;
    for (const part of parts) {
      if (!cur || typeof cur !== "object" || !(part in cur)) {
        ok = false;
        break;
      }
      cur = cur[part];
    }
    if (ok && cur) return safe(cur);
  }
  return "";
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

function qualifiedService(a: any) {
  if (!a || typeof a !== "object") return "";
  const tags: string[] = [];
  const findNeed = Array.isArray(a.find_need) ? a.find_need : [];
  const leadNeed = Array.isArray(a.lead_need) ? a.lead_need : [];
  const opsNeed = Array.isArray(a.ops_need) ? a.ops_need : [];

  if (findNeed.length) tags.push("SEO / FINDABILITY");
  if (leadNeed.length) tags.push("AI RECEPTION / LEAD CAPTURE");
  if (opsNeed.length) tags.push("AUTOMATION / OPS");

  return tags.join(", ");
}

const PIPELINE = [
  { key: "new", label: "New Inquiry" },
  { key: "qualified", label: "Qualified" },
  { key: "working", label: "Working" },
  { key: "proposal", label: "Proposal Sent" },
  { key: "paid", label: "Paid / Setup" },
  { key: "recurring", label: "Recurring" },
  { key: "past_due", label: "Past Due" },
  { key: "closed", label: "Closed (Won)" },
  { key: "lost", label: "Closed (Lost)" },
];

export default async function PipelinePage() {
  const supabase = await createSupabaseServer();

  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) redirect("/internal/login");

  const { data: u } = await supabase.auth.getUser();
  if (!isStaff(u.user)) redirect("/");

  const allowed = new Set(PIPELINE.map((p) => p.key));

  async function moveLeadStage(formData: FormData) {
    "use server";
    const leadId = String(formData.get("lead_id") ?? "").trim();
    const nextStage = String(formData.get("stage") ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (!leadId || !nextStage) return;
    if (!allowed.has(nextStage)) return;

    // Re-verify staff on every mutation
    const sb = await createSupabaseServer();
    const { data: sess2 } = await sb.auth.getSession();
    if (!sess2.session) throw new Error("unauthorized");

    const { data: u2 } = await sb.auth.getUser();
    if (!isStaff(u2.user)) throw new Error("forbidden");

    // Use admin client to bypass RLS safely (staff-gated above)
    const admin = createSupabaseAdmin();
    const { error } = await admin.from("leads").update({ stage: nextStage }).eq("id", leadId);
    if (error) throw new Error(error.message);
  }

    // ✅ Read using admin client so internal staff can see everything (RLS-proof)
  const admin = createSupabaseAdmin();

  const { data: leadsRaw, error: leadsErr } = await admin
    .from("leads")
    .select(
      "id, created_at, stage, source, full_name, name, email, phone, company_name, website, notes, assessment, deal_value, mrr, probability, next_step"
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (leadsErr) throw new Error(leadsErr.message);


  const leads = (leadsRaw ?? []).map((l: any) => {
    const st = safe(l.stage || "new").toLowerCase().replace(/\s+/g, "_");
    const stageKey = allowed.has(st) ? st : "new";

    const display =
      safe(l.full_name) ||
      safe(l.name) ||
      safe(l.company_name) ||
      safe(l.email) ||
      `LEAD ${safe(l.id).slice(0, 6)}`;

    const addr = pick(l.assessment, ["address", "businessAddress", "discovery.address", "discovery.location"]);
    const industry = pick(l.assessment, ["industry", "businessIndustry", "discovery.industry"]);
    const assessed = hasAssessment(l.assessment);

    return {
      ...l,
      _display: display.toUpperCase(),
      _company: (safe(l.company_name) || "COMPANY").toUpperCase(),
      _stage: stageKey,
      _address: addr,
      _industry: industry,
      _assessed: assessed,
      _qualified_service: qualifiedService(l.assessment),
      _notes: safe(l.notes),
    };
  });

  const grouped: Record<string, any[]> = {};
  for (const p of PIPELINE) grouped[p.key] = [];
  for (const l of leads) {
    if (!grouped[l._stage]) grouped[l._stage] = [];
    grouped[l._stage].push(l);
  }

  return <PipelineClient pipeline={PIPELINE} grouped={grouped} moveLeadStage={moveLeadStage} />;
}