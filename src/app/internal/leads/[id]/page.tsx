// src/app/internal/leads/[id]/page.tsx
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import ls from "./lead.module.css";

import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

async function requireStaff() {
  const sb = await createSupabaseServer();

  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) redirect("/internal/login");

  const { data: u } = await sb.auth.getUser();
  if (!isStaff(u.user)) redirect("/");

  return { sb, user: u.user };
}

const PIPELINE = [
  { key: "new", label: "New Inquiry" },
  { key: "qualified", label: "Qualified" },
  { key: "working", label: "Working" },
  { key: "proposal", label: "Proposal" },
  { key: "paid", label: "Paid" },
  { key: "recurring", label: "Recurring" },
  { key: "past_due", label: "Past Due" },
  { key: "closed", label: "Closed" },
];

function safe(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function asObj(v: any): Record<string, any> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, any>;
  return {};
}

function fmtList(v: any) {
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (typeof v === "string") return v;
  return "";
}

function firstStr(...vals: any[]) {
  for (const v of vals) {
    const s = safe(v).trim();
    if (s) return s;
  }
  return "";
}

function yn(v: any) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function hasMarketingAssessment(a: any) {
  if (!a || typeof a !== "object") return false;
  const anyCore =
    Boolean(safe(a.fullName || a.name || a.email || a.phone).trim()) ||
    Boolean(safe(a.companyName || a.company_name || a.currentWebsite || a.website).trim());

  const anyLists =
    (Array.isArray(a.find_have) && a.find_have.length) ||
    (Array.isArray(a.find_need) && a.find_need.length) ||
    (Array.isArray(a.lead_have) && a.lead_have.length) ||
    (Array.isArray(a.lead_need) && a.lead_need.length) ||
    (Array.isArray(a.ops_have) && a.ops_have.length) ||
    (Array.isArray(a.ops_need) && a.ops_need.length);

  const anyNotes = Boolean(a.find_notes || a.lead_notes || a.ops_notes || a.final_notes);

  return Boolean(anyCore || anyLists || anyNotes);
}

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: SearchParams;
}) {
  const { id: rawId } = await params; // Next 15/16
  const sp = (await searchParams) ?? {};

  const id = String(rawId || "").trim();

  // ✅ Require staff session, but we will read/write lead using admin to avoid RLS “silent fails”
  await requireStaff();

  if (!isUuid(id)) {
    return (
      <div className={ls.page}>
        <div className={ls.bg} />
        <div className={ls.bgOverlay} />
        <div className={ls.inner}>
          <div className={ls.card + " " + ls.cardPad}>
            <div className={ls.sectionTitle}>Invalid Lead ID</div>
            <div className={ls.sub} style={{ marginTop: 8 }}>
              ID: {id || "(empty)"}
            </div>
            <div style={{ marginTop: 14 }}>
              <Link className={ls.btnBack} href="/internal/leads">
                Back
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { data: lead, error } = await supabaseAdmin.from("leads").select("*").eq("id", id).maybeSingle();

  if (error || !lead) {
    return (
      <div className={ls.page}>
        <div className={ls.bg} />
        <div className={ls.bgOverlay} />
        <div className={ls.inner}>
          <div className={ls.card + " " + ls.cardPad}>
            <div className={ls.sectionTitle}>Lead not found</div>
            <div className={ls.sub} style={{ marginTop: 8 }}>
              ID: {id}
            </div>

            <div className={ls.card + " " + ls.cardPad} style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 950, color: "var(--k-text)" }}>Error</div>
              <div className={ls.sub} style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                {error?.message ? error.message : "No row returned."}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link className={ls.btnBack} href="/internal/leads">
                  Back
                </Link>
                <Link className={ls.btnGhost} href={`/internal/leads/${encodeURIComponent(id)}`}>
                  Retry
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stageRaw = safe((lead as any).stage || "new")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const stage = PIPELINE.some((p) => p.key === stageRaw) ? stageRaw : "new";

  const assessmentObj = asObj((lead as any).assessment);
  const intakeObj = asObj((lead as any).intake);

  const discoveryObj = asObj((lead as any).discovery);
  const discoveryStatus = String((lead as any).discovery_status ?? "not_started");
  const discoveryCompletedAt = (lead as any).discovery_completed_at ?? null;
  const discoveryUpdatedAt = (lead as any).discovery_updated_at ?? null;

  const discoveryIsComplete = discoveryStatus === "complete" || Boolean(discoveryCompletedAt);
  const discoveryHasAnyData = Object.keys(discoveryObj).length > 0;
  const discoveryState = discoveryIsComplete ? "Complete" : discoveryHasAnyData ? "In progress" : "Not started";
  const showSalesStudio = !discoveryIsComplete;

  const name =
    safe((lead as any).company_name) ||
    safe((lead as any).full_name) ||
    safe((lead as any).name) ||
    safe((lead as any).email) ||
    `Lead ${safe((lead as any).id).slice(0, 6)}`;

  // Intake best-effort (prefer intakeObj first, then assessmentObj, then lead fields)
  const intakeCompany = firstStr(
    (lead as any).company_name,
    intakeObj.companyName,
    intakeObj.company_name,
    assessmentObj.companyName,
    assessmentObj.company_name,
    name
  );
  const intakeContact = firstStr(
    intakeObj.contactName,
    intakeObj.contact_name,
    assessmentObj.contactName,
    assessmentObj.contact_name,
    (lead as any).full_name,
    (lead as any).name
  );
  const intakeIndustry = firstStr(
    intakeObj.industry,
    assessmentObj.industry,
    assessmentObj.businessIndustry,
    assessmentObj.serviceIndustry
  );
  const intakeLeadType = firstStr(intakeObj.leadType, assessmentObj.leadType, assessmentObj.typeOfLead, assessmentObj.type_of_lead);
  const intakeReferral = firstStr(intakeObj.referralName, intakeObj.referral_name, assessmentObj.referralName, assessmentObj.referral_name);
  const intakeRep = firstStr(intakeObj.kallrRep, intakeObj.repName, intakeObj.rep_name, assessmentObj.kallrRep, assessmentObj.repName, assessmentObj.rep_name);

  const workingText = safe(assessmentObj.working_text);
  const vapiPrompts: { id: string; name: string; prompt: string }[] = Array.isArray(assessmentObj.vapi_prompts)
    ? assessmentObj.vapi_prompts
    : [];

  const deleteStep = (() => {
    const v = (sp as any)?.delete;
    const raw = Array.isArray(v) ? v[0] : v;
    return raw === "1" ? 1 : 0;
  })();

  async function saveStage(formData: FormData) {
    "use server";
    await requireStaff();

    const leadId = String(formData.get("lead_id") ?? "").trim();
    const nextStage = String(formData.get("stage") ?? "").trim();
    if (!leadId || !nextStage) return;

    await supabaseAdmin.from("leads").update({ stage: nextStage }).eq("id", leadId);
  }

  async function saveDeal(formData: FormData) {
    "use server";
    await requireStaff();

    const leadId = String(formData.get("lead_id") ?? "").trim();
    if (!leadId) return;

    const deal_value = Number(formData.get("deal_value") ?? 0) || null;
    const mrr = Number(formData.get("mrr") ?? 0) || null;
    const probability = Number(formData.get("probability") ?? 0) || null;
    const next_step = String(formData.get("next_step") ?? "").trim() || null;

    await supabaseAdmin.from("leads").update({ deal_value, mrr, probability, next_step }).eq("id", leadId);
  }

  async function saveNotes(formData: FormData) {
    "use server";
    await requireStaff();

    const leadId = String(formData.get("lead_id") ?? "").trim();
    const nextNotes = String(formData.get("notes") ?? "");
    if (!leadId) return;

    await supabaseAdmin.from("leads").update({ notes: nextNotes }).eq("id", leadId);
  }

  async function saveWorkingText(formData: FormData) {
    "use server";
    await requireStaff();

    const leadId = String(formData.get("lead_id") ?? "").trim();
    const next = String(formData.get("working_text") ?? "");
    if (!leadId) return;

    const { data: row } = await supabaseAdmin.from("leads").select("assessment").eq("id", leadId).maybeSingle();
    const prev = asObj((row as any)?.assessment);

    await supabaseAdmin.from("leads").update({ assessment: { ...prev, working_text: next } }).eq("id", leadId);
  }

  async function addVapiPrompt(formData: FormData) {
    "use server";
    await requireStaff();

    const leadId = String(formData.get("lead_id") ?? "").trim();
    const name = String(formData.get("prompt_name") ?? "").trim();
    const prompt = String(formData.get("prompt_text") ?? "").trim();
    if (!leadId || !name || !prompt) return;

    const { data: row } = await supabaseAdmin.from("leads").select("assessment").eq("id", leadId).maybeSingle();
    const prev = asObj((row as any)?.assessment);

    const list: any[] = Array.isArray(prev.vapi_prompts) ? prev.vapi_prompts : [];
    const newId =
      (globalThis as any).crypto?.randomUUID?.() ??
      `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const nextList = [...list, { id: newId, name, prompt }];
    await supabaseAdmin.from("leads").update({ assessment: { ...prev, vapi_prompts: nextList } }).eq("id", leadId);
  }

  async function saveVapiPrompt(formData: FormData) {
    "use server";
    await requireStaff();

    const leadId = String(formData.get("lead_id") ?? "").trim();
    const pid = String(formData.get("pid") ?? "").trim();
    const name = String(formData.get("prompt_name") ?? "").trim();
    const prompt = String(formData.get("prompt_text") ?? "").trim();
    if (!leadId || !pid) return;

    const { data: row } = await supabaseAdmin.from("leads").select("assessment").eq("id", leadId).maybeSingle();
    const prev = asObj((row as any)?.assessment);

    const list: any[] = Array.isArray(prev.vapi_prompts) ? prev.vapi_prompts : [];
    const nextList = list.map((p) => (p?.id === pid ? { ...p, name, prompt } : p));

    await supabaseAdmin.from("leads").update({ assessment: { ...prev, vapi_prompts: nextList } }).eq("id", leadId);
  }

  async function deleteVapiPrompt(formData: FormData) {
    "use server";
    await requireStaff();

    const leadId = String(formData.get("lead_id") ?? "").trim();
    const pid = String(formData.get("pid") ?? "").trim();
    if (!leadId || !pid) return;

    const { data: row } = await supabaseAdmin.from("leads").select("assessment").eq("id", leadId).maybeSingle();
    const prev = asObj((row as any)?.assessment);

    const list: any[] = Array.isArray(prev.vapi_prompts) ? prev.vapi_prompts : [];
    const nextList = list.filter((p) => p?.id !== pid);

    await supabaseAdmin.from("leads").update({ assessment: { ...prev, vapi_prompts: nextList } }).eq("id", leadId);
  }

  async function beginDelete() {
    "use server";
    await requireStaff();
    redirect(`/internal/leads/${encodeURIComponent(id)}?delete=1`);
  }

  async function cancelDelete() {
    "use server";
    await requireStaff();
    redirect(`/internal/leads/${encodeURIComponent(id)}`);
  }

  async function confirmDelete() {
    "use server";
    await requireStaff();
    await supabaseAdmin.from("leads").delete().eq("id", id);
    redirect("/internal/leads");
  }

  // Marketing assessment fields (from your modal)
  const aFullName = firstStr(assessmentObj.fullName, assessmentObj.name, (lead as any).full_name, (lead as any).name);
  const aEmail = firstStr(assessmentObj.email, (lead as any).email);
  const aPhone = firstStr(assessmentObj.phone, (lead as any).phone);
  const aCompany = firstStr(assessmentObj.companyName, assessmentObj.company_name, (lead as any).company_name);
  const aWebsite = firstStr(assessmentObj.currentWebsite, assessmentObj.website, (lead as any).website);

  return (
    <div className={ls.page}>
      <div className={ls.bg} aria-hidden="true" />
      <div className={ls.bgOverlay} aria-hidden="true" />

      <div className={ls.inner}>
        {/* Header */}
        <div className={ls.headerRow}>
          <div className={ls.headerLeft}>
            <div className={ls.brandMark}>
              <Image src="/neais-logo.png" alt="NEAIS" width={34} height={34} className={ls.brandLogo} />
              <div className={ls.sub} style={{ fontWeight: 950 }}>
                Lead Profile
              </div>
            </div>

            <div className={ls.headerTitle}>{name}</div>

            <div className={ls.headerMeta}>
              <div className={ls.pill}>
                <span className={ls.pillDot} />
                <span className={ls.pillMuted}>Discovery:</span> {discoveryState}
              </div>

              <div className={ls.pill}>
                <span className={ls.pillDot} />
                <span className={ls.pillMuted}>Stage:</span>{" "}
                {PIPELINE.find((p) => p.key === stage)?.label ?? "New Inquiry"}
              </div>

              {discoveryUpdatedAt ? (
                <div className={ls.pill}>
                  <span className={ls.pillDot} />
                  <span className={ls.pillMuted}>Updated:</span> {safe(discoveryUpdatedAt)}
                </div>
              ) : null}

              {discoveryCompletedAt ? (
                <div className={ls.pill}>
                  <span className={ls.pillDot} />
                  <span className={ls.pillMuted}>Completed:</span> {safe(discoveryCompletedAt)}
                </div>
              ) : null}
            </div>

            {showSalesStudio ? (
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link className={ls.btnPrimarySm} href={`/internal/proposals/${encodeURIComponent(id)}`}>
                  Open Sales Studio (Complete Discovery)
                </Link>
              </div>
            ) : null}
          </div>

          <div className={ls.headerActions}>
            <Link className={ls.btnBack} href="/internal/leads">
              Back
            </Link>
          </div>
        </div>

        <div className={ls.split}>
          {/* Left column */}
          <section className={ls.col}>
            {/* Pipeline */}
            <div className={`${ls.card} ${ls.cardPad}`}>
              <div className={ls.sectionTitleRow}>
                <div className={ls.sectionTitle}>Pipeline</div>
                <div className={ls.sectionHint}>Move lead through stages</div>
              </div>

              <form action={saveStage} style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                <input type="hidden" name="lead_id" value={(lead as any).id} />
                <select
                  name="stage"
                  defaultValue={stage}
                  className={ls.input as any}
                  style={{ flex: 1 } as CSSProperties}
                >
                  {PIPELINE.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className={ls.btnPrimary}>
                  Save
                </button>
              </form>
            </div>

            {/* Intake */}
            <div className={`${ls.card} ${ls.cardPad}`}>
              <div className={ls.sectionTitleRow}>
                <div className={ls.sectionTitle}>Intake</div>
                <div className={ls.sectionHint}>Primary profile info</div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <Row k="Company" v={intakeCompany || "—"} />
                <Row k="Contact" v={intakeContact || "—"} />
                <Row k="Phone" v={safe((lead as any).phone) || "—"} />
                <Row k="Email" v={safe((lead as any).email) || "—"} />
                <Row k="Industry" v={intakeIndustry || "—"} />
                <Row k="Lead type" v={intakeLeadType || "—"} />
                <Row k="Referral" v={intakeReferral || "—"} />
                <Row k="Kallr rep" v={intakeRep || "—"} />
                <Row k="Source" v={safe((lead as any).source) || "—"} />
                <Row k="Website" v={safe((lead as any).website) || "—"} />
                <Row k="Lead ID" v={safe((lead as any).id) || "—"} />
              </div>
            </div>

            {/* ✅ NEW: Marketing Assessment (Steps 1–5) */}
            <div className={`${ls.card} ${ls.cardPad}`}>
              <div className={ls.sectionTitleRow}>
                <div className={ls.sectionTitle}>Assessment (Marketing)</div>
                <div className={ls.sectionHint}>Step 1–5 answers from the website form</div>
              </div>

              {!hasMarketingAssessment(assessmentObj) ? (
                <div className={ls.sub} style={{ marginTop: 12, fontWeight: 950 }}>
                  —
                </div>
              ) : (
                <div className={ls.detailsStack}>
                  <details open>
                    <summary className={ls.summary}>Step 1 — Contact + Consent</summary>
                    <div className={ls.kvStack}>
                      <KV k="Full name" v={aFullName || "—"} />
                      <KV k="Email" v={aEmail || "—"} />
                      <KV k="Phone" v={aPhone || "—"} />
                      <KV k="Company" v={aCompany || "—"} />
                      <KV k="Website" v={aWebsite || "—"} />
                      <KV k="Call/text back" v={yn(assessmentObj.callbackOptIn)} />
                      <KV k="SMS (transactional)" v={yn(assessmentObj.smsTransactionalOptIn)} />
                      <KV k="SMS (marketing)" v={yn(assessmentObj.smsMarketingOptIn)} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Step 2 — Findability</summary>
                    <div className={ls.kvStack}>
                      <KV k="Have" v={fmtList(assessmentObj.find_have) || "—"} />
                      <KV k="Need" v={fmtList(assessmentObj.find_need) || "—"} />
                      <KV k="Notes" v={safe(assessmentObj.find_notes) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Step 3 — Lead Capture</summary>
                    <div className={ls.kvStack}>
                      <KV k="Have" v={fmtList(assessmentObj.lead_have) || "—"} />
                      <KV k="Need" v={fmtList(assessmentObj.lead_need) || "—"} />
                      <KV k="Notes" v={safe(assessmentObj.lead_notes) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Step 4 — Operational Leverage</summary>
                    <div className={ls.kvStack}>
                      <KV k="Have" v={fmtList(assessmentObj.ops_have) || "—"} />
                      <KV k="Need" v={fmtList(assessmentObj.ops_need) || "—"} />
                      <KV k="Notes" v={safe(assessmentObj.ops_notes) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Step 5 — Final Notes</summary>
                    <div className={ls.kvStack}>
                      <KV k="Final notes" v={safe(assessmentObj.final_notes) || "—"} />
                    </div>
                  </details>

                  {/* ✅ Guarantees every future field is always viewable */}
                  <details>
                    <summary className={ls.summary}>Raw Assessment JSON (Everything)</summary>
                    <div style={{ marginTop: 10 }}>
                      <pre
                        style={{
                          margin: 0,
                          padding: 12,
                          borderRadius: 12,
                          background: "rgba(2,6,23,0.04)",
                          border: "1px solid rgba(2,6,23,0.10)",
                          overflowX: "auto",
                          fontSize: 12,
                          lineHeight: 1.45,
                          whiteSpace: "pre",
                        }}
                      >
                        {JSON.stringify(assessmentObj, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* Discovery */}
            <div className={`${ls.card} ${ls.cardPad}`}>
              <div className={ls.sectionTitleRow}>
                <div className={ls.sectionTitle}>Discovery</div>
                <div className={ls.sectionHint}>What Sales Studio captured</div>
              </div>

              {!Object.keys(discoveryObj).length ? (
                <div className={ls.sub} style={{ marginTop: 12, fontWeight: 950 }}>
                  —
                </div>
              ) : (
                <div className={ls.detailsStack}>
                  <details>
                    <summary className={ls.summary}>Business Snapshot</summary>
                    <div className={ls.kvStack}>
                      <KV k="Service area" v={safe(discoveryObj.snapshot?.serviceArea) || "—"} />
                      <KV k="Locations" v={safe(discoveryObj.snapshot?.locations) || "—"} />
                      <KV k="Website / booking" v={safe(discoveryObj.snapshot?.websiteBookingLink) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Goals</summary>
                    <div className={ls.kvStack}>
                      <KV k="Objectives" v={fmtList(discoveryObj.goals?.objectives) || "—"} />
                      <KV k="Qualified lead" v={safe(discoveryObj.goals?.qualifiedLead) || "—"} />
                      <KV k="Current issues" v={safe(discoveryObj.goals?.currentCallingIssues) || "—"} />
                      <KV k="Success metric" v={safe(discoveryObj.goals?.successMetric) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Traffic</summary>
                    <div className={ls.kvStack}>
                      <KV k="Calls/day" v={safe(discoveryObj.traffic?.callsDay) || "—"} />
                      <KV k="Calls/week" v={safe(discoveryObj.traffic?.callsWeek) || "—"} />
                      <KV k="Calls/month" v={safe(discoveryObj.traffic?.callsMonth) || "—"} />
                      <KV k="Peak times" v={safe(discoveryObj.traffic?.peakTimes) || "—"} />
                      <KV k="Avg length" v={safe(discoveryObj.traffic?.avgCallLength) || "—"} />
                      <KV k="Seasonality" v={safe(discoveryObj.traffic?.seasonality) || "—"} />
                      <KV k="After-hours" v={safe(discoveryObj.traffic?.afterHoursImportance) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Caller Intent</summary>
                    <div className={ls.kvStack}>
                      <KV
                        k="Top reasons"
                        v={
                          Array.isArray(discoveryObj.callReasons?.topReasons)
                            ? discoveryObj.callReasons.topReasons
                                .map((r: any, i: number) =>
                                  [r?.reason, r?.idealOutcome].filter(Boolean).join(" — ") || `Reason ${i + 1}`
                                )
                                .filter(Boolean)
                                .join(" • ")
                            : "—"
                        }
                      />
                      <KV k="Where is the close" v={safe(discoveryObj.callReasons?.whereIsTheClose) || "—"} />
                      <KV k="Call flow" v={safe(discoveryObj.callReasons?.avgCallFlow) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Booking</summary>
                    <div className={ls.kvStack}>
                      <KV k="Mode" v={safe(discoveryObj.booking?.wantsBooking) || "—"} />
                      <KV k="System" v={safe(discoveryObj.booking?.bookingSystem) || "—"} />
                      <KV k="Restrictions" v={safe(discoveryObj.booking?.restrictions) || "—"} />
                      <KV k="Deposit" v={safe(discoveryObj.booking?.depositRequired) || "—"} />
                      <KV k="Deposit rules" v={safe(discoveryObj.booking?.depositRules) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Routing</summary>
                    <div className={ls.kvStack}>
                      <KV k="Primary" v={safe(discoveryObj.routing?.primaryDuringHours) || "—"} />
                      <KV k="Backup" v={safe(discoveryObj.routing?.backupIfNoAnswer) || "—"} />
                      <KV k="If no answer" v={safe(discoveryObj.routing?.ifNoAnswer) || "—"} />
                      <KV k="Urgent" v={safe(discoveryObj.routing?.urgentDefinition) || "—"} />
                      <KV k="VIP rules" v={safe(discoveryObj.routing?.vipRules) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Required Info</summary>
                    <div className={ls.kvStack}>
                      <KV k="Fields" v={fmtList(discoveryObj.requiredInfo?.fields) || "—"} />
                      <KV k="Other" v={safe(discoveryObj.requiredInfo?.other) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Pricing</summary>
                    <div className={ls.kvStack}>
                      <KV k="Policy" v={safe(discoveryObj.pricing?.pricingPolicy) || "—"} />
                      <KV k="Starting at" v={safe(discoveryObj.pricing?.startingAtRanges) || "—"} />
                      <KV k="Policies" v={safe(discoveryObj.pricing?.policies) || "—"} />
                      <KV k="Avoid" v={safe(discoveryObj.pricing?.phrasesToAvoid) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Tools</summary>
                    <div className={ls.kvStack}>
                      <KV k="Phone system" v={safe(discoveryObj.tools?.phoneSystem) || "—"} />
                      <KV k="Number" v={safe(discoveryObj.tools?.numberPreference) || "—"} />
                      <KV k="CRM" v={safe(discoveryObj.tools?.crm) || "—"} />
                      <KV k="Scheduling" v={safe(discoveryObj.tools?.schedulingTool) || "—"} />
                      <KV k="Notifications" v={fmtList(discoveryObj.tools?.notifications) || "—"} />
                      <KV k="Other" v={safe(discoveryObj.tools?.otherNotifications) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Voice</summary>
                    <div className={ls.kvStack}>
                      <KV k="Vibe" v={safe(discoveryObj.voice?.vibe) || "—"} />
                      <KV k="Must say" v={safe(discoveryObj.voice?.mustSay) || "—"} />
                      <KV k="Avoid" v={safe(discoveryObj.voice?.wordsToAvoid) || "—"} />
                      <KV k="Greeting" v={safe(discoveryObj.voice?.preferredGreeting) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Launch</summary>
                    <div className={ls.kvStack}>
                      <KV k="Go-live" v={safe(discoveryObj.launch?.goLiveDate) || "—"} />
                      <KV k="Coverage" v={safe(discoveryObj.launch?.coverage) || "—"} />
                      <KV k="Special hours" v={safe(discoveryObj.launch?.promosOrHours) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Approval</summary>
                    <div className={ls.kvStack}>
                      <KV k="Approver" v={safe(discoveryObj.approval?.approverNameRole) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>SEO</summary>
                    <div className={ls.kvStack}>
                      <KV k="Website goal" v={safe(discoveryObj.seo?.websiteGoal) || "—"} />
                      <KV k="Lead destination" v={safe(discoveryObj.seo?.leadDestination) || "—"} />
                      <KV k="GBP" v={safe(discoveryObj.seo?.hasGbp) || "—"} />
                      <KV k="Posting" v={safe(discoveryObj.seo?.gbpPosting) || "—"} />
                      <KV k="Platforms" v={fmtList(discoveryObj.seo?.reviewPlatforms) || "—"} />
                      <KV k="Rating" v={safe(discoveryObj.seo?.googleRatingAndCount) || "—"} />
                      <KV k="Reviews owner" v={safe(discoveryObj.seo?.whoAsksReviews) || "—"} />
                      <KV k="Lead sources" v={fmtList(discoveryObj.seo?.leadSources) || "—"} />
                      <KV k="Other source" v={safe(discoveryObj.seo?.otherLeadSource) || "—"} />
                    </div>
                  </details>

                  <details>
                    <summary className={ls.summary}>Scorecard</summary>
                    <div className={ls.kvStack}>
                      <KV k="Complexity" v={safe(discoveryObj.scorecard?.complexity) || "—"} />
                      <KV k="Locations" v={safe(discoveryObj.scorecard?.locationsCount) || "—"} />
                      <KV k="Intents" v={safe(discoveryObj.scorecard?.intentsCount) || "—"} />
                      <KV k="Integrations" v={safe(discoveryObj.scorecard?.integrations) || "—"} />
                      <KV k="After-hours" v={safe(discoveryObj.scorecard?.afterHours) || "—"} />
                      <KV k="Deposit" v={safe(discoveryObj.scorecard?.depositPayment) || "—"} />
                      <KV k="Routing" v={safe(discoveryObj.scorecard?.routingComplexity) || "—"} />
                      <KV k="Timeline" v={safe(discoveryObj.scorecard?.timelineUrgency) || "—"} />
                    </div>
                  </details>

                  {/* ✅ THIS guarantees every future question/field is always viewable */}
                  <details>
                    <summary className={ls.summary}>Raw Discovery JSON (Everything)</summary>
                    <div style={{ marginTop: 10 }}>
                      <pre
                        style={{
                          margin: 0,
                          padding: 12,
                          borderRadius: 12,
                          background: "rgba(2,6,23,0.04)",
                          border: "1px solid rgba(2,6,23,0.10)",
                          overflowX: "auto",
                          fontSize: 12,
                          lineHeight: 1.45,
                          whiteSpace: "pre",
                        }}
                      >
                        {JSON.stringify(discoveryObj, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className={`${ls.card} ${ls.cardPad}`}>
              <div className={ls.sectionTitleRow}>
                <div className={ls.sectionTitle}>Notes</div>
                <div className={ls.sectionHint}>Internal notes for this lead</div>
              </div>

              <form action={saveNotes} style={{ marginTop: 12 }}>
                <input type="hidden" name="lead_id" value={(lead as any).id} />
                <textarea
                  name="notes"
                  defaultValue={safe((lead as any).notes)}
                  rows={10}
                  placeholder="Notes…"
                  className={ls.textarea}
                />
                <div className={ls.rowActionsRight}>
                  <button type="submit" className={ls.btnPrimary}>
                    Save
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Right column */}
          <aside className={ls.col}>
            {/* Deal */}
            <div className={`${ls.card} ${ls.cardPad}`}>
              <div className={ls.sectionTitleRow}>
                <div className={ls.sectionTitle}>Deal</div>
                <div className={ls.sectionHint}>Value + next step</div>
              </div>

              <form action={saveDeal} style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <input type="hidden" name="lead_id" value={(lead as any).id} />
                <input
                  name="deal_value"
                  defaultValue={safe((lead as any).deal_value)}
                  placeholder="Setup $"
                  className={ls.input}
                />
                <input name="mrr" defaultValue={safe((lead as any).mrr)} placeholder="Monthly $" className={ls.input} />
                <input
                  name="probability"
                  defaultValue={safe((lead as any).probability)}
                  placeholder="Probability 0-100"
                  className={ls.input}
                />
                <input
                  name="next_step"
                  defaultValue={safe((lead as any).next_step)}
                  placeholder="Next step"
                  className={ls.input}
                />
                <button type="submit" className={ls.btnPrimary}>
                  Save
                </button>
              </form>
            </div>

            {/* Billing (placeholder) */}
            <div className={`${ls.card} ${ls.cardPad}`}>
              <div className={ls.sectionTitleRow}>
                <div className={ls.sectionTitle}>Billing</div>
                <div className={ls.sectionHint}>Invoices + subscriptions</div>
              </div>
              <div className={ls.sub} style={{ marginTop: 10 }}>
                Invoices, payment status, subscriptions, receipts.
              </div>
              <div className={ls.pill} style={{ marginTop: 12, width: "fit-content" }}>
                Coming soon
              </div>
            </div>

            {/* Working text */}
            <div className={`${ls.card} ${ls.cardPad}`}>
              <div className={ls.sectionTitleRow}>
                <div className={ls.sectionTitle}>Working Text</div>
                <div className={ls.sectionHint}>Draft scripts / notes</div>
              </div>

              <form action={saveWorkingText} style={{ marginTop: 12 }}>
                <input type="hidden" name="lead_id" value={(lead as any).id} />
                <textarea
                  name="working_text"
                  defaultValue={workingText}
                  rows={10}
                  placeholder="Working text…"
                  className={ls.textarea}
                />
                <div className={ls.rowActionsRight}>
                  <button type="submit" className={ls.btnPrimary}>
                    Save
                  </button>
                </div>
              </form>
            </div>

            {/* VAPI prompts */}
            <div className={`${ls.card} ${ls.cardPad}`}>
              <div className={ls.sectionTitleRow}>
                <div className={ls.sectionTitle}>Vapi Prompts</div>
                <div className={ls.sectionHint}>Saved prompts for build</div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {vapiPrompts.length ? (
                  vapiPrompts.map((p) => (
                    <div key={p.id} className={ls.card} style={{ background: "rgba(255,255,255,0.78)" }}>
                      <div className={ls.cardPad}>
                        <form action={saveVapiPrompt} style={{ display: "grid", gap: 10 }}>
                          <input type="hidden" name="lead_id" value={(lead as any).id} />
                          <input type="hidden" name="pid" value={p.id} />
                          <input
                            name="prompt_name"
                            defaultValue={safe(p.name)}
                            placeholder="Prompt name"
                            className={ls.input}
                          />
                          <textarea
                            name="prompt_text"
                            defaultValue={safe(p.prompt)}
                            rows={8}
                            placeholder="Prompt…"
                            className={ls.textarea}
                          />
                          <div className={ls.rowActionsRight}>
                            <button type="submit" className={ls.btnPrimarySm}>
                              Save
                            </button>
                          </div>
                        </form>

                        <form
                          action={deleteVapiPrompt}
                          style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}
                        >
                          <input type="hidden" name="lead_id" value={(lead as any).id} />
                          <input type="hidden" name="pid" value={p.id} />
                          <button type="submit" className={ls.btnGhost}>
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={ls.sub} style={{ fontWeight: 950 }}>
                    —
                  </div>
                )}

                <div className={ls.card} style={{ background: "rgba(2,6,23,0.02)" }}>
                  <div className={ls.cardPad}>
                    <form action={addVapiPrompt} style={{ display: "grid", gap: 10 }}>
                      <input type="hidden" name="lead_id" value={(lead as any).id} />
                      <input name="prompt_name" placeholder="New prompt name" className={ls.input} />
                      <textarea name="prompt_text" rows={8} placeholder="New prompt…" className={ls.textarea} />
                      <div className={ls.rowActionsRight}>
                        <button type="submit" className={ls.btnPrimary}>
                          Add
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            {/* Delete (2-step confirm) */}
            <div className={`${ls.card} ${ls.cardPad}`}>
              <div className={ls.sectionTitleRow}>
                <div className={ls.sectionTitle}>Delete Lead</div>
                <div className={ls.sectionHint}>Permanent action</div>
              </div>

              {deleteStep === 0 ? (
                <form action={beginDelete} className={ls.rowActionsRight}>
                  <button type="submit" className={ls.btnGhost}>
                    Continue
                  </button>
                </form>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <div className={ls.sub} style={{ marginBottom: 12 }}>
                    Are you sure?
                  </div>

                  <div className={ls.dangerRow}>
                    <form action={cancelDelete}>
                      <button type="submit" className={ls.btnGhost}>
                        Cancel
                      </button>
                    </form>

                    <form action={confirmDelete}>
                      <button type="submit" className={ls.btnPrimary}>
                        Delete permanently
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={ls.row}>
      <div className={ls.k}>{k}</div>
      <div className={ls.v}>{v}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className={ls.row}>
      <div className={ls.k}>{k}</div>
      <div className={ls.v}>{v}</div>
    </div>
  );
}