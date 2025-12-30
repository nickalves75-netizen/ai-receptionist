"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./proposal.module.css";

type StepKey =
  | "snapshot"
  | "goals"
  | "traffic"
  | "callReasons"
  | "booking"
  | "routing"
  | "requiredInfo"
  | "pricing"
  | "tools"
  | "voice"
  | "launch"
  | "approval"
  | "seo"
  | "scorecard";

type LeadDiscovery = {
  snapshot?: {
    serviceArea?: string;
    locations?: string;
    websiteBookingLink?: string;
  };

  goals?: {
    objectives?: string[];
    qualifiedLead?: string;
    currentCallingIssues?: string;
    successMetric?: string;
  };

  traffic?: {
    callsDay?: string;
    callsWeek?: string;
    callsMonth?: string;
    peakTimes?: string;
    avgCallLength?: string;
    seasonality?: string;
    afterHoursImportance?: "Not important" | "Somewhat" | "Very important" | "Critical";
  };

  callReasons?: {
    topReasons?: { reason: string; idealOutcome: string }[];
    whereIsTheClose?: string;
    avgCallFlow?: string;
  };

  booking?: {
    wantsBooking?: "Book" | "Reschedule/Cancel" | "Collect info + transfer" | "Not applicable";
    bookingSystem?: string;
    restrictions?: string;
    depositRequired?: "Yes" | "No";
    depositRules?: string;
  };

  routing?: {
    primaryDuringHours?: string;
    backupIfNoAnswer?: string;
    ifNoAnswer?: "Take message + notify" | "Text booking link" | "Create callback queue" | "Forward to voicemail";
    urgentDefinition?: string;
    vipRules?: string;
  };

  requiredInfo?: {
    fields?: string[];
    other?: string;
  };

  pricing?: {
    pricingPolicy?: "Never" | "Ranges only" | "Exact for specific services";
    startingAtRanges?: string;
    policies?: string;
    phrasesToAvoid?: string;
  };

  tools?: {
    phoneSystem?: string;
    numberPreference?: "Existing number" | "New number" | "Both";
    crm?: string;
    schedulingTool?: string;
    notifications?: string[];
    otherNotifications?: string;
  };

  voice?: {
    vibe?: "Straight professional" | "Friendly + casual" | "Luxury / white-glove" | "Fast + direct";
    mustSay?: string;
    wordsToAvoid?: string;
    preferredGreeting?: string;
  };

  launch?: {
    goLiveDate?: string;
    coverage?: "Business-hours only" | "After-hours included" | "24/7 coverage";
    promosOrHours?: string;
  };

  approval?: {
    approverNameRole?: string;
  };

  seo?: {
    websiteGoal?: string;
    leadDestination?: string;
    hasGbp?: "Yes" | "No" | "Not sure";
    gbpPosting?: "Weekly" | "Monthly" | "Rarely" | "Never";
    reviewPlatforms?: string[];
    googleRatingAndCount?: string;
    whoAsksReviews?: string;
    leadSources?: string[];
    otherLeadSource?: string;
  };

  scorecard?: {
    complexity?: "A" | "B" | "C";
    locationsCount?: string;
    intentsCount?: string;
    integrations?: string;
    afterHours?: "Y" | "N";
    depositPayment?: "Y" | "N";
    routingComplexity?: "low" | "med" | "high";
    timelineUrgency?: "low" | "med" | "high";
  };
};

const STEPS: { key: StepKey; title: string; subtitle: string }[] = [
  { key: "snapshot", title: "Business Snapshot", subtitle: "Core operating context" },
  { key: "goals", title: "Goals & Success", subtitle: "What winning looks like" },
  { key: "traffic", title: "Call Traffic", subtitle: "Volume, patterns, after-hours" },
  { key: "callReasons", title: "Caller Intent", subtitle: "Top reasons people call" },
  { key: "booking", title: "Booking Rules", subtitle: "Scheduling & deposits" },
  { key: "routing", title: "Routing & Escalations", subtitle: "Who gets what, when" },
  { key: "requiredInfo", title: "Required Info", subtitle: "Always capture these fields" },
  { key: "pricing", title: "Pricing & Policies", subtitle: "Boundaries & phrasing" },
  { key: "tools", title: "Tools & Access", subtitle: "Systems we integrate" },
  { key: "voice", title: "Brand Voice", subtitle: "How Kallr should sound" },
  { key: "launch", title: "Launch Plan", subtitle: "Go-live, coverage, specials" },
  { key: "approval", title: "Approval", subtitle: "Who signs off on flows" },
  { key: "seo", title: "SEO Add-On", subtitle: "Visibility & reviews" },
  { key: "scorecard", title: "Internal Scorecard", subtitle: "Complexity & scope" },
];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
function str(v: unknown): string {
  return (v ?? "").toString().trim();
}
function hasText(v: unknown): boolean {
  return str(v).length > 0;
}
function hasAnyText(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== "object") return hasText(obj);
  if (Array.isArray(obj)) return obj.some((x) => hasAnyText(x));
  const record = obj as Record<string, unknown>;
  return Object.values(record).some((v) => hasAnyText(v));
}

function isStepComplete(key: StepKey, d: LeadDiscovery): boolean {
  switch (key) {
    case "snapshot":
      return hasText(d.snapshot?.serviceArea) || hasText(d.snapshot?.locations) || hasText(d.snapshot?.websiteBookingLink);

    case "goals":
      return (
        (d.goals?.objectives?.length ?? 0) > 0 ||
        hasText(d.goals?.qualifiedLead) ||
        hasText(d.goals?.currentCallingIssues) ||
        hasText(d.goals?.successMetric)
      );

    case "traffic":
      return (
        hasText(d.traffic?.callsDay) ||
        hasText(d.traffic?.callsWeek) ||
        hasText(d.traffic?.callsMonth) ||
        hasText(d.traffic?.peakTimes) ||
        hasText(d.traffic?.avgCallLength) ||
        hasText(d.traffic?.seasonality) ||
        hasText(d.traffic?.afterHoursImportance)
      );

    case "callReasons":
      return (
        (d.callReasons?.topReasons ?? []).some((r) => hasText(r.reason) || hasText(r.idealOutcome)) ||
        hasText(d.callReasons?.whereIsTheClose) ||
        hasText(d.callReasons?.avgCallFlow)
      );

    case "booking":
      return hasAnyText(d.booking);

    case "routing":
      return hasAnyText(d.routing);

    case "requiredInfo":
      return (d.requiredInfo?.fields?.length ?? 0) > 0 || hasText(d.requiredInfo?.other);

    case "pricing":
      return hasAnyText(d.pricing);

    case "tools":
      return hasAnyText(d.tools);

    case "voice":
      return hasAnyText(d.voice);

    case "launch":
      return hasAnyText(d.launch);

    case "approval":
      return hasText(d.approval?.approverNameRole);

    case "seo":
      return hasAnyText(d.seo);

    case "scorecard":
      return hasAnyText(d.scorecard);

    default:
      return false;
  }
}

export default function ProposalWizardPage() {
  const router = useRouter();
  const params = useParams();

  // ✅ critical fix: always get the id from useParams() in client pages
  const leadId = useMemo(() => {
    const raw = (params as any)?.id;
    return String(Array.isArray(raw) ? raw[0] : raw || "").trim();
  }, [params]);

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveHint, setSaveHint] = useState<string>("Ready");

  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const [discovery, setDiscovery] = useState<LeadDiscovery>({
    callReasons: { topReasons: [{ reason: "", idealOutcome: "" }] },
    booking: { wantsBooking: "Book", bookingSystem: "", restrictions: "", depositRequired: "No", depositRules: "" },
  });

  // Debounced autosave
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJson = useRef<string>("");

  const completed = useMemo(() => STEPS.map((s) => isStepComplete(s.key, discovery)), [discovery]);

  const maxUnlockedIndex = useMemo(() => {
    let max = 0;
    for (let i = 1; i < STEPS.length; i++) {
      if (completed[i - 1]) max = i;
      else break;
    }
    return Math.max(max, stepIndex);
  }, [completed, stepIndex]);

  const progressPct = useMemo(() => {
    if (STEPS.length <= 1) return 0;
    return Math.round((stepIndex / (STEPS.length - 1)) * 100);
  }, [stepIndex]);

  async function load(): Promise<void> {
    if (!leadId) {
      setLoading(false);
      setSaveHint("Missing lead id — open Sales Studio from a lead page.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/discovery`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Load failed (${res.status})`);
      }

      const next = (data?.discovery ?? {}) as LeadDiscovery;

      const safeNext: LeadDiscovery = {
        callReasons: { topReasons: [{ reason: "", idealOutcome: "" }] },
        booking: { wantsBooking: "Book", bookingSystem: "", restrictions: "", depositRequired: "No", depositRules: "" },
        ...next,
      };

      // Ensure callReasons always has at least 1 row
      if (!safeNext.callReasons?.topReasons || safeNext.callReasons.topReasons.length === 0) {
        safeNext.callReasons = { ...(safeNext.callReasons ?? {}), topReasons: [{ reason: "", idealOutcome: "" }] };
      }

      // Ensure booking object exists so Step 5 never renders “nothing”
      safeNext.booking = {
        wantsBooking: "Book",
        bookingSystem: "",
        restrictions: "",
        depositRequired: "No",
        depositRules: "",
        ...(safeNext.booking ?? {}),
      };

      setDiscovery(safeNext);
      lastSavedJson.current = JSON.stringify(safeNext ?? {});
      setSaveHint("Loaded");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setSaveHint(`Load failed: ${msg}`);
      console.error("Discovery load failed:", e);
    } finally {
      setLoading(false);
    }
  }

  async function saveNow(reason: string, opts?: { status?: "not_started" | "in_progress" | "complete" }): Promise<void> {
    if (!leadId) {
      setSaveHint("Missing lead id — cannot save");
      return;
    }

    const payload = discovery ?? {};
    const json = JSON.stringify(payload);

    if (json === lastSavedJson.current && !opts?.status) {
      setSaveHint("Saved");
      return;
    }

    setSaving(true);
    setSaveHint(reason);

    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/discovery`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ discovery: payload, status: opts?.status }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Save failed (${res.status})`);

      lastSavedJson.current = json;
      setSaveHint("Saved");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setSaveHint(`Save failed: ${msg}`);
      console.error("Discovery save failed:", e);
    } finally {
      setSaving(false);
    }
  }

  function scheduleAutosave(): void {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveNow("Auto-saving…");
    }, 650);
  }

  function update<K extends keyof LeadDiscovery>(key: K, value: LeadDiscovery[K]): void {
    setDiscovery((prev) => ({ ...prev, [key]: value }));
    scheduleAutosave();
  }

  function goTo(i: number): void {
    if (i <= maxUnlockedIndex) {
      setStepIndex(i);
      void saveNow("Saving…");
    }
  }

  function next(): void {
    if (!completed[stepIndex]) {
      setSaveHint("Fill at least one field on this step to unlock the next");
      return;
    }
    const n = clamp(stepIndex + 1, 0, STEPS.length - 1);
    setStepIndex(n);
    void saveNow("Saving…");
  }

  function back(): void {
    const n = clamp(stepIndex - 1, 0, STEPS.length - 1);
    setStepIndex(n);
    void saveNow("Saving…");
  }

  async function saveAndExit(): Promise<void> {
    await saveNow("Saving…");
    router.push(`/internal/leads/${encodeURIComponent(leadId)}`);
    router.refresh();
  }

  async function finalizeProposal(): Promise<void> {
    if (finishing) return;
    if (!leadId) {
      setSaveHint("Missing lead id — cannot finalize");
      return;
    }

    setFinishing(true);
    try {
      // ✅ mark complete so the lead page hides Sales Studio + shows Complete
      const payload = discovery ?? {};
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/discovery`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ discovery: payload, status: "complete" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Finalize failed (${res.status})`);

      router.push(`/internal/leads/${encodeURIComponent(leadId)}`);
      router.refresh();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setSaveHint(`Finalize failed: ${msg}`);
      console.error("Finalize failed:", e);
    } finally {
      setFinishing(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmExit(true);
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") next();
      if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") back();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, completed, maxUnlockedIndex]);

  const topReasons = discovery.callReasons?.topReasons ?? [{ reason: "", idealOutcome: "" }];

  function setTopReason(i: number, patch: Partial<{ reason: string; idealOutcome: string }>) {
    const nextReasons = [...topReasons];
    nextReasons[i] = { ...nextReasons[i], ...patch };
    update("callReasons", { ...(discovery.callReasons ?? {}), topReasons: nextReasons });
  }

  function addTopReason() {
    update("callReasons", {
      ...(discovery.callReasons ?? {}),
      topReasons: [...topReasons, { reason: "", idealOutcome: "" }],
    });
  }

  function removeTopReason(i: number) {
    const next = topReasons.filter((_, idx) => idx !== i);
    update("callReasons", {
      ...(discovery.callReasons ?? {}),
      topReasons: next.length ? next : [{ reason: "", idealOutcome: "" }],
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.bg} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.brand}>
          <Image src="/kallr.png" alt="Kallr" width={58} height={58} className={styles.brandLogo} />
          <div className={styles.brandTitle}>Sales Studio</div>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.stepText}>
            Step <strong>{stepIndex + 1}</strong> of <strong>{STEPS.length}</strong>
          </div>
          <div className={styles.headerHint}>{saving ? "Saving…" : saveHint}</div>
        </div>

        <div className={styles.headerRight}>
          <button type="button" className={styles.exitBtn} onClick={() => setConfirmExit(true)}>
            Exit
          </button>
        </div>
      </header>

      <section className={styles.shell}>
        <div className={styles.vProgress} aria-hidden="true">
          <div className={styles.vTrack} />
          <div className={styles.vFill} style={{ height: `${progressPct}%` }} />
        </div>

        <aside className={styles.rail}>
          <div className={styles.railCard}>
            <div className={styles.railHeader}>Roadmap</div>

            <div className={styles.railList}>
              {STEPS.map((s, i) => {
                const active = i === stepIndex;
                const isLocked = i > maxUnlockedIndex;
                const isDone = completed[i];

                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`${styles.railItem} ${active ? styles.railItemActive : ""} ${
                      isLocked ? styles.railItemLocked : ""
                    }`}
                    onClick={() => goTo(i)}
                    disabled={isLocked}
                  >
                    <span className={styles.railIcon}>
                      {isDone ? <IconCheck /> : isLocked ? <IconLock /> : active ? <IconSpark /> : <IconDot />}
                    </span>

                    <span className={styles.railText}>
                      <span className={styles.railTitle}>{s.title}</span>
                      <span className={styles.railSub}>{s.subtitle}</span>
                    </span>

                    <span className={styles.railRight}>
                      {isDone ? (
                        <span className={styles.badgeDone}>Done</span>
                      ) : isLocked ? (
                        <span className={styles.badgeLocked}>Locked</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className={styles.stage}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <h1 className={styles.h1}>{step.title}</h1>
                <div className={styles.sub}>{step.subtitle}</div>
              </div>

              {loading ? <div className={styles.loadingPill}>Loading…</div> : null}
            </div>

            <div className={styles.content}>
              {step.key === "snapshot" && (
                <div className={styles.grid2}>
                  <Field
                    label="Service area"
                    value={discovery.snapshot?.serviceArea ?? ""}
                    onChange={(v) => update("snapshot", { ...(discovery.snapshot ?? {}), serviceArea: v })}
                    placeholder="Cities / radius / zip codes"
                  />
                  <Field
                    label="Locations"
                    value={discovery.snapshot?.locations ?? ""}
                    onChange={(v) => update("snapshot", { ...(discovery.snapshot ?? {}), locations: v })}
                    placeholder="How many locations? Addresses or notes"
                  />
                  <Field
                    label="Website / booking link"
                    value={discovery.snapshot?.websiteBookingLink ?? ""}
                    onChange={(v) => update("snapshot", { ...(discovery.snapshot ?? {}), websiteBookingLink: v })}
                    placeholder="Link (if any)"
                    wide
                  />
                </div>
              )}

              {step.key === "goals" && (
                <div className={styles.stack}>
                  <Checklist
                    label="What do you want Kallr to accomplish?"
                    value={discovery.goals?.objectives ?? []}
                    options={[
                      "Answer every call",
                      "Book appointments",
                      "Qualify leads",
                      "Route calls to the right person",
                      "Reduce interruptions for staff",
                      "After-hours capture / booking",
                      "Payments / deposits",
                    ]}
                    otherLabel="Other"
                    onChange={(arr) => update("goals", { ...(discovery.goals ?? {}), objectives: arr })}
                  />

                  <TextArea
                    label="What is a qualified lead for your business?"
                    value={discovery.goals?.qualifiedLead ?? ""}
                    onChange={(v) => update("goals", { ...(discovery.goals ?? {}), qualifiedLead: v })}
                    placeholder="Define what ‘qualified’ means for you"
                  />
                  <TextArea
                    label="Anything wrong with your current calling system today?"
                    value={discovery.goals?.currentCallingIssues ?? ""}
                    onChange={(v) => update("goals", { ...(discovery.goals ?? {}), currentCallingIssues: v })}
                    placeholder="Missed calls, misrouting, interruptions, poor experience, etc."
                  />
                  <TextArea
                    label="What outcome matters most?"
                    value={discovery.goals?.successMetric ?? ""}
                    onChange={(v) => update("goals", { ...(discovery.goals ?? {}), successMetric: v })}
                    placeholder="Booked appointments, closed deals, reduced missed calls, etc."
                  />
                </div>
              )}

              {/* ✅ STEP 3: TRAFFIC (present, not blank) */}
              {step.key === "traffic" && (
                <div className={styles.stack}>
                  <div className={styles.grid3}>
                    <Field
                      label="Calls per day"
                      value={discovery.traffic?.callsDay ?? ""}
                      onChange={(v) => update("traffic", { ...(discovery.traffic ?? {}), callsDay: v })}
                      placeholder="e.g. 20"
                    />
                    <Field
                      label="Calls per week"
                      value={discovery.traffic?.callsWeek ?? ""}
                      onChange={(v) => update("traffic", { ...(discovery.traffic ?? {}), callsWeek: v })}
                      placeholder="e.g. 120"
                    />
                    <Field
                      label="Calls per month"
                      value={discovery.traffic?.callsMonth ?? ""}
                      onChange={(v) => update("traffic", { ...(discovery.traffic ?? {}), callsMonth: v })}
                      placeholder="e.g. 450"
                    />
                  </div>

                  <Field
                    label="Peak days / peak hours"
                    value={discovery.traffic?.peakTimes ?? ""}
                    onChange={(v) => update("traffic", { ...(discovery.traffic ?? {}), peakTimes: v })}
                    placeholder="When do calls spike?"
                  />
                  <Field
                    label="Average call length"
                    value={discovery.traffic?.avgCallLength ?? ""}
                    onChange={(v) => update("traffic", { ...(discovery.traffic ?? {}), avgCallLength: v })}
                    placeholder="Estimate"
                  />
                  <Field
                    label="Seasonality"
                    value={discovery.traffic?.seasonality ?? ""}
                    onChange={(v) => update("traffic", { ...(discovery.traffic ?? {}), seasonality: v })}
                    placeholder="Busy months / slow months"
                  />

                  <Select
                    label="After-hours handling importance"
                    value={discovery.traffic?.afterHoursImportance ?? "Somewhat"}
                    options={["Not important", "Somewhat", "Very important", "Critical"]}
                    onChange={(v) => update("traffic", { ...(discovery.traffic ?? {}), afterHoursImportance: v as any })}
                  />
                </div>
              )}

              {step.key === "callReasons" && (
                <div className={styles.stack}>
                  <div className={styles.sectionTitle}>Top call reasons</div>
                  <div className={styles.sub}>List what callers usually want and the ideal outcome for each.</div>

                  <div className={styles.reasons}>
                    {topReasons.map((r, i) => (
                      <div key={i} className={styles.reasonRow}>
                        <Field
                          label={`Reason #${i + 1}`}
                          value={r.reason}
                          onChange={(v) => setTopReason(i, { reason: v })}
                          placeholder="e.g. new quote, schedule, reschedule"
                        />
                        <Field
                          label="Ideal outcome"
                          value={r.idealOutcome}
                          onChange={(v) => setTopReason(i, { idealOutcome: v })}
                          placeholder="Book / Route / Collect info / SMS link / Payment"
                        />

                        <div className={styles.reasonActions}>
                          <button type="button" className={styles.smallBtn} onClick={addTopReason}>
                            + Add
                          </button>
                          {topReasons.length > 1 && (
                            <button type="button" className={styles.smallBtnDanger} onClick={() => removeTopReason(i)}>
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <TextArea
                    label="Where is the close?"
                    value={discovery.callReasons?.whereIsTheClose ?? ""}
                    onChange={(v) => update("callReasons", { ...(discovery.callReasons ?? {}), whereIsTheClose: v })}
                    placeholder="At what point does the caller become booked / confirmed / paid?"
                  />

                  <TextArea
                    label="Average call flow (how do calls go today?)"
                    value={discovery.callReasons?.avgCallFlow ?? ""}
                    onChange={(v) => update("callReasons", { ...(discovery.callReasons ?? {}), avgCallFlow: v })}
                    placeholder="Quick outline of current script"
                  />
                </div>
              )}

              {/* ✅ STEP 5: BOOKING (never blank) */}
              {step.key === "booking" && (
                <div className={styles.stack}>
                  <Select
                    label="What should Kallr do with appointments?"
                    value={discovery.booking?.wantsBooking ?? "Book"}
                    options={["Book", "Reschedule/Cancel", "Collect info + transfer", "Not applicable"]}
                    onChange={(v) => update("booking", { ...(discovery.booking ?? {}), wantsBooking: v as any })}
                  />
                  <Field
                    label="Booking system"
                    value={discovery.booking?.bookingSystem ?? ""}
                    onChange={(v) => update("booking", { ...(discovery.booking ?? {}), bookingSystem: v })}
                    placeholder="Calendar/CRM/software"
                  />
                  <TextArea
                    label="Booking restrictions"
                    value={discovery.booking?.restrictions ?? ""}
                    onChange={(v) => update("booking", { ...(discovery.booking ?? {}), restrictions: v })}
                    placeholder="Lead time, same-day, weekends, blackout dates"
                  />
                  <Select
                    label="Require deposits or payment holds?"
                    value={discovery.booking?.depositRequired ?? "No"}
                    options={["Yes", "No"]}
                    onChange={(v) => update("booking", { ...(discovery.booking ?? {}), depositRequired: v as any })}
                  />
                  <TextArea
                    label="Deposit rules"
                    value={discovery.booking?.depositRules ?? ""}
                    onChange={(v) => update("booking", { ...(discovery.booking ?? {}), depositRules: v })}
                    placeholder="Amount/rules"
                  />
                </div>
              )}

              {step.key === "routing" && (
                <div className={styles.stack}>
                  <Field
                    label="Who receives calls during business hours?"
                    value={discovery.routing?.primaryDuringHours ?? ""}
                    onChange={(v) => update("routing", { ...(discovery.routing ?? {}), primaryDuringHours: v })}
                    placeholder="Names/roles"
                  />
                  <Field
                    label="Backup if they don’t answer"
                    value={discovery.routing?.backupIfNoAnswer ?? ""}
                    onChange={(v) => update("routing", { ...(discovery.routing ?? {}), backupIfNoAnswer: v })}
                    placeholder="Names/roles"
                  />
                  <Select
                    label="If no one answers, what happens?"
                    value={discovery.routing?.ifNoAnswer ?? "Take message + notify"}
                    options={["Take message + notify", "Text booking link", "Create callback queue", "Forward to voicemail"]}
                    onChange={(v) => update("routing", { ...(discovery.routing ?? {}), ifNoAnswer: v as any })}
                  />
                  <TextArea
                    label="What is urgent and how should Kallr handle it?"
                    value={discovery.routing?.urgentDefinition ?? ""}
                    onChange={(v) => update("routing", { ...(discovery.routing ?? {}), urgentDefinition: v })}
                    placeholder="Define urgent + escalation"
                  />
                  <TextArea
                    label="VIP / repeat customer rules"
                    value={discovery.routing?.vipRules ?? ""}
                    onChange={(v) => update("routing", { ...(discovery.routing ?? {}), vipRules: v })}
                    placeholder="Any special routing rules"
                  />
                </div>
              )}

              {step.key === "requiredInfo" && (
                <div className={styles.stack}>
                  <Checklist
                    label="Info Kallr must always collect"
                    value={discovery.requiredInfo?.fields ?? []}
                    options={[
                      "Full name",
                      "Phone number",
                      "Email",
                      "Address / service location",
                      "Service requested",
                      "Preferred date/time",
                      "Budget range",
                      "Notes / photos link",
                    ]}
                    otherLabel="Other"
                    onChange={(arr) => update("requiredInfo", { ...(discovery.requiredInfo ?? {}), fields: arr })}
                  />
                  <TextArea
                    label="Other required info (if any)"
                    value={discovery.requiredInfo?.other ?? ""}
                    onChange={(v) => update("requiredInfo", { ...(discovery.requiredInfo ?? {}), other: v })}
                    placeholder="Any additional required fields"
                  />
                </div>
              )}

              {step.key === "pricing" && (
                <div className={styles.stack}>
                  <Select
                    label="Pricing discussion policy"
                    value={discovery.pricing?.pricingPolicy ?? "Ranges only"}
                    options={["Never", "Ranges only", "Exact for specific services"]}
                    onChange={(v) => update("pricing", { ...(discovery.pricing ?? {}), pricingPolicy: v as any })}
                  />
                  <TextArea
                    label="Starting-at ranges (optional)"
                    value={discovery.pricing?.startingAtRanges ?? ""}
                    onChange={(v) => update("pricing", { ...(discovery.pricing ?? {}), startingAtRanges: v })}
                    placeholder="List ranges you’re comfortable with"
                  />
                  <TextArea
                    label="Policies Kallr must enforce"
                    value={discovery.pricing?.policies ?? ""}
                    onChange={(v) => update("pricing", { ...(discovery.pricing ?? {}), policies: v })}
                    placeholder="Cancellation, late policy, travel fees, deposits, service-area limits"
                  />
                  <TextArea
                    label="Phrases to avoid"
                    value={discovery.pricing?.phrasesToAvoid ?? ""}
                    onChange={(v) => update("pricing", { ...(discovery.pricing ?? {}), phrasesToAvoid: v })}
                    placeholder="Any phrases you do NOT want used on calls"
                  />
                </div>
              )}

              {step.key === "tools" && (
                <div className={styles.stack}>
                  <Field
                    label="Phone system today"
                    value={discovery.tools?.phoneSystem ?? ""}
                    onChange={(v) => update("tools", { ...(discovery.tools ?? {}), phoneSystem: v })}
                    placeholder="Carrier / VoIP / provider"
                  />
                  <Select
                    label="Number preference"
                    value={discovery.tools?.numberPreference ?? "Existing number"}
                    options={["Existing number", "New number", "Both"]}
                    onChange={(v) => update("tools", { ...(discovery.tools ?? {}), numberPreference: v as any })}
                  />
                  <Field
                    label="CRM (if any)"
                    value={discovery.tools?.crm ?? ""}
                    onChange={(v) => update("tools", { ...(discovery.tools ?? {}), crm: v })}
                    placeholder="HubSpot, ServiceTitan, etc."
                  />
                  <Field
                    label="Scheduling tool (if any)"
                    value={discovery.tools?.schedulingTool ?? ""}
                    onChange={(v) => update("tools", { ...(discovery.tools ?? {}), schedulingTool: v })}
                    placeholder="Calendly, Acuity, etc."
                  />
                  <Checklist
                    label="Notification preferences"
                    value={discovery.tools?.notifications ?? []}
                    options={["SMS", "Email", "Slack"]}
                    otherLabel="Other"
                    onChange={(arr) => update("tools", { ...(discovery.tools ?? {}), notifications: arr })}
                  />
                  <Field
                    label="Other notifications"
                    value={discovery.tools?.otherNotifications ?? ""}
                    onChange={(v) => update("tools", { ...(discovery.tools ?? {}), otherNotifications: v })}
                    placeholder="Optional"
                  />
                </div>
              )}

              {step.key === "voice" && (
                <div className={styles.stack}>
                  <Select
                    label="Brand vibe"
                    value={discovery.voice?.vibe ?? "Straight professional"}
                    options={["Straight professional", "Friendly + casual", "Luxury / white-glove", "Fast + direct"]}
                    onChange={(v) => update("voice", { ...(discovery.voice ?? {}), vibe: v as any })}
                  />
                  <TextArea
                    label="Must-say lines / positioning (optional)"
                    value={discovery.voice?.mustSay ?? ""}
                    onChange={(v) => update("voice", { ...(discovery.voice ?? {}), mustSay: v })}
                    placeholder="Any key positioning lines"
                  />
                  <TextArea
                    label="Words to avoid (optional)"
                    value={discovery.voice?.wordsToAvoid ?? ""}
                    onChange={(v) => update("voice", { ...(discovery.voice ?? {}), wordsToAvoid: v })}
                    placeholder="Words that do not fit the brand"
                  />
                  <TextArea
                    label="Preferred greeting (write it exactly)"
                    value={discovery.voice?.preferredGreeting ?? ""}
                    onChange={(v) => update("voice", { ...(discovery.voice ?? {}), preferredGreeting: v })}
                    placeholder="Exact greeting you want callers to hear"
                  />
                </div>
              )}

              {step.key === "launch" && (
                <div className={styles.stack}>
                  <Field
                    label="Desired go-live date"
                    value={discovery.launch?.goLiveDate ?? ""}
                    onChange={(v) => update("launch", { ...(discovery.launch ?? {}), goLiveDate: v })}
                    placeholder="YYYY-MM-DD or note"
                  />
                  <Select
                    label="Coverage"
                    value={discovery.launch?.coverage ?? "After-hours included"}
                    options={["Business-hours only", "After-hours included", "24/7 coverage"]}
                    onChange={(v) => update("launch", { ...(discovery.launch ?? {}), coverage: v as any })}
                  />
                  <TextArea
                    label="Promotions or special hours"
                    value={discovery.launch?.promosOrHours ?? ""}
                    onChange={(v) => update("launch", { ...(discovery.launch ?? {}), promosOrHours: v })}
                    placeholder="Anything we should know about"
                  />
                </div>
              )}

              {step.key === "approval" && (
                <div className={styles.stack}>
                  <Field
                    label="Final approver (name + role)"
                    value={discovery.approval?.approverNameRole ?? ""}
                    onChange={(v) => update("approval", { ...(discovery.approval ?? {}), approverNameRole: v })}
                    placeholder="Who signs off on call flows and wording?"
                  />
                </div>
              )}

              {step.key === "seo" && (
                <div className={styles.stack}>
                  <div className={styles.grid2}>
                    <Select
                      label="Website main goal"
                      value={discovery.seo?.websiteGoal ?? "Calls"}
                      options={["Calls", "Form leads", "Online booking", "Other"]}
                      onChange={(v) => update("seo", { ...(discovery.seo ?? {}), websiteGoal: v })}
                    />
                    <Select
                      label="Where do leads go today?"
                      value={discovery.seo?.leadDestination ?? "Email"}
                      options={["Email", "CRM", "Spreadsheet", "Missed calls", "Other"]}
                      onChange={(v) => update("seo", { ...(discovery.seo ?? {}), leadDestination: v })}
                    />
                  </div>

                  <div className={styles.grid2}>
                    <Select
                      label="Google Business Profile?"
                      value={discovery.seo?.hasGbp ?? "Not sure"}
                      options={["Yes", "No", "Not sure"]}
                      onChange={(v) => update("seo", { ...(discovery.seo ?? {}), hasGbp: v as any })}
                    />
                    <Select
                      label="GBP posting frequency"
                      value={discovery.seo?.gbpPosting ?? "Rarely"}
                      options={["Weekly", "Monthly", "Rarely", "Never"]}
                      onChange={(v) => update("seo", { ...(discovery.seo ?? {}), gbpPosting: v as any })}
                    />
                  </div>

                  <Checklist
                    label="Review platforms you care about"
                    value={discovery.seo?.reviewPlatforms ?? []}
                    options={["Google", "Yelp", "Facebook"]}
                    otherLabel="Other"
                    onChange={(arr) => update("seo", { ...(discovery.seo ?? {}), reviewPlatforms: arr })}
                  />

                  <Field
                    label="Approx Google rating + # of reviews"
                    value={discovery.seo?.googleRatingAndCount ?? ""}
                    onChange={(v) => update("seo", { ...(discovery.seo ?? {}), googleRatingAndCount: v })}
                    placeholder="e.g. 4.8 (212 reviews)"
                  />
                  <Field
                    label="Who requests reviews?"
                    value={discovery.seo?.whoAsksReviews ?? ""}
                    onChange={(v) => update("seo", { ...(discovery.seo ?? {}), whoAsksReviews: v })}
                    placeholder="Owner / manager / staff / automated"
                  />

                  <Checklist
                    label="Where do most leads come from today?"
                    value={discovery.seo?.leadSources ?? []}
                    options={["Google", "Social", "Referrals", "Ads"]}
                    otherLabel="Other"
                    onChange={(arr) => update("seo", { ...(discovery.seo ?? {}), leadSources: arr })}
                  />

                  <Field
                    label="Other lead source (if needed)"
                    value={discovery.seo?.otherLeadSource ?? ""}
                    onChange={(v) => update("seo", { ...(discovery.seo ?? {}), otherLeadSource: v })}
                    placeholder="Optional"
                  />
                </div>
              )}

              {step.key === "scorecard" && (
                <div className={styles.stack}>
                  <div className={styles.grid3}>
                    <Select
                      label="Complexity"
                      value={discovery.scorecard?.complexity ?? "B"}
                      options={["A", "B", "C"]}
                      onChange={(v) => update("scorecard", { ...(discovery.scorecard ?? {}), complexity: v as any })}
                    />
                    <Field
                      label="Locations"
                      value={discovery.scorecard?.locationsCount ?? ""}
                      onChange={(v) => update("scorecard", { ...(discovery.scorecard ?? {}), locationsCount: v })}
                      placeholder="# or notes"
                    />
                    <Field
                      label="Intents"
                      value={discovery.scorecard?.intentsCount ?? ""}
                      onChange={(v) => update("scorecard", { ...(discovery.scorecard ?? {}), intentsCount: v })}
                      placeholder="# of call reasons"
                    />
                  </div>

                  <Field
                    label="Integrations"
                    value={discovery.scorecard?.integrations ?? ""}
                    onChange={(v) => update("scorecard", { ...(discovery.scorecard ?? {}), integrations: v })}
                    placeholder="Calendar/CRM/SMS/etc."
                  />

                  <div className={styles.grid3}>
                    <Select
                      label="After-hours"
                      value={discovery.scorecard?.afterHours ?? "Y"}
                      options={["Y", "N"]}
                      onChange={(v) => update("scorecard", { ...(discovery.scorecard ?? {}), afterHours: v as any })}
                    />
                    <Select
                      label="Deposit/payment"
                      value={discovery.scorecard?.depositPayment ?? "N"}
                      options={["Y", "N"]}
                      onChange={(v) => update("scorecard", { ...(discovery.scorecard ?? {}), depositPayment: v as any })}
                    />
                    <Select
                      label="Routing complexity"
                      value={discovery.scorecard?.routingComplexity ?? "med"}
                      options={["low", "med", "high"]}
                      onChange={(v) => update("scorecard", { ...(discovery.scorecard ?? {}), routingComplexity: v as any })}
                    />
                  </div>

                  <Select
                    label="Timeline urgency"
                    value={discovery.scorecard?.timelineUrgency ?? "med"}
                    options={["low", "med", "high"]}
                    onChange={(v) => update("scorecard", { ...(discovery.scorecard ?? {}), timelineUrgency: v as any })}
                  />
                </div>
              )}
            </div>

            <footer className={styles.footer}>
              <button type="button" className={styles.btnGhost} onClick={back} disabled={stepIndex === 0}>
                ← Back
              </button>

              <div className={styles.footerCenter}>
                <div className={styles.footerStatus}>
                  {saving ? "Saving…" : completed[stepIndex] ? "Step complete" : "Fill at least one field to unlock next"}
                </div>
              </div>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => {
                  if (stepIndex === STEPS.length - 1) setConfirmFinish(true);
                  else next();
                }}
                disabled={finishing || (stepIndex === STEPS.length - 1 ? !completed[stepIndex] : false)}
              >
                {stepIndex === STEPS.length - 1 ? "Finish" : "Next →"}
              </button>
            </footer>
          </div>
        </section>
      </section>

      {confirmExit && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Exit proposal?</div>
            <div className={styles.modalSub}>Are you sure you want to exit proposal?</div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setConfirmExit(false)} disabled={finishing}>
                Go back
              </button>
              <button type="button" className={styles.btnPrimary} onClick={saveAndExit} disabled={finishing}>
                Save &amp; exit
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmFinish && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Confirm new Proposal profile</div>
            <div className={styles.modalSub}>
              Kallr will generate your final mockup, scope outline, and follow-up steps after our engineering team reviews this profile.
              <br />
              <span className={styles.modalSubStrong}>No pricing is shown here — every business is qualified first.</span>
            </div>

            <div className={styles.finishRow}>
              <div className={styles.spinner} aria-hidden="true" />
              <div className={styles.finishCopy}>
                {finishing ? (
                  <>
                    <strong>Finalizing…</strong> Saving everything to this lead now.
                  </>
                ) : (
                  <>
                    Once you confirm, everything you entered will be saved to this lead and marked <strong>Ready for Review</strong>.
                  </>
                )}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setConfirmFinish(false)} disabled={finishing}>
                Go back
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={finalizeProposal}
                disabled={finishing || !completed[stepIndex]}
              >
                {finishing ? "Finalizing…" : "Confirm & Finish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- UI helpers ---------- */

function IconDot() {
  return <span className={styles.iDot} aria-hidden="true" />;
}
function IconSpark() {
  return <span className={styles.iSpark} aria-hidden="true" />;
}
function IconLock() {
  return <span className={styles.iLock} aria-hidden="true" />;
}
function IconCheck() {
  return <span className={styles.iCheck} aria-hidden="true" />;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.field} ${wide ? styles.wide : ""}`}>
      <div className={styles.label}>{label}</div>
      <input
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ""}
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.label}>{label}</div>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ""}
        rows={4}
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.label}>{label}</div>
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Checklist({
  label,
  value,
  options,
  otherLabel,
  onChange,
}: {
  label: string;
  value: string[];
  options: string[];
  otherLabel: string;
  onChange: (arr: string[]) => void;
}) {
  const set = new Set(value || []);
  function toggle(item: string) {
    const next = new Set(set);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    onChange(Array.from(next));
  }

  return (
    <div className={styles.field}>
      <div className={styles.label}>{label}</div>
      <div className={styles.checkGrid}>
        {options.map((o) => (
          <button
            type="button"
            key={o}
            className={`${styles.check} ${set.has(o) ? styles.checkOn : ""}`}
            onClick={() => toggle(o)}
          >
            <span className={styles.checkBox} />
            <span className={styles.checkText}>{o}</span>
          </button>
        ))}
        <button
          type="button"
          className={`${styles.check} ${set.has(otherLabel) ? styles.checkOn : ""}`}
          onClick={() => toggle(otherLabel)}
        >
          <span className={styles.checkBox} />
          <span className={styles.checkText}>{otherLabel}</span>
        </button>
      </div>
    </div>
  );
}
