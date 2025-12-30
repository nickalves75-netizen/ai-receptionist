"use client";

import { useMemo, useState } from "react";
import styles from "./LeadFormModal.module.css";

type Props = { open: boolean; onClose: () => void; source: string };

type AssessmentData = {
  // Step 1
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  currentWebsite: string;

  callbackOptIn: boolean;
  smsTransactionalOptIn: boolean;
  smsMarketingOptIn: boolean;

  // Step 2: Findability
  find_have: string[];
  find_need: string[];
  find_notes: string;

  // Step 3: Lead Capture
  lead_have: string[];
  lead_need: string[];
  lead_notes: string;

  // Step 4: Operational Leverage
  ops_have: string[];
  ops_need: string[];
  ops_notes: string;

  // Step 5: Final
  final_notes: string;
};

const initialData: AssessmentData = {
  fullName: "",
  email: "",
  phone: "",
  companyName: "",
  currentWebsite: "",

  callbackOptIn: true,
  smsTransactionalOptIn: false,
  smsMarketingOptIn: false,

  find_have: [],
  find_need: [],
  find_notes: "",

  lead_have: [],
  lead_need: [],
  lead_notes: "",

  ops_have: [],
  ops_need: [],
  ops_notes: "",

  final_notes: "",
};

function toggleInArray(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function looksLikeEmail(v: string) {
  const s = v.trim();
  return s.includes("@") && s.includes(".");
}

export default function LeadFormModal({ open, onClose, source }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<AssessmentData>(initialData);
  const total = 5;

  // ✅ success-state for thank-you popup
  const [submitted, setSubmitted] = useState(false);

  const canNext = useMemo(() => {
    if (step === 1) {
      const full = data.fullName.trim().length > 0;
      const emailOk = looksLikeEmail(data.email);
      const phoneOk = data.phone.trim().length > 0;
      return full && emailOk && phoneOk;
    }
    return true;
  }, [step, data.fullName, data.email, data.phone]);

  function closeNow() {
    setStep(1);
    setSubmitting(false);
    setSubmitted(false);
    setData(initialData);
    onClose();
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketing/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: typeof window !== "undefined" ? window.location.href : "",
          name: data.fullName,
          email: data.email,

          phone: data.phone,
          companyName: data.companyName,
          currentWebsite: data.currentWebsite,
          source,

          data,
        }),
      });

      if (!res.ok) {
  const j = await res.json().catch(() => null);
  throw new Error(j?.detail || j?.error || "Submit failed");
}


      // ✅ DO NOT close modal — show thank-you popup instead
      setSubmitting(false);
      setSubmitted(true);
    } catch (e) {
      setSubmitting(false);
      alert("Submission failed. Please try again.");
    }
  }

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.shell}>
        <button className={styles.close} type="button" onClick={closeNow} aria-label="Close">
          ✕
        </button>

        <div className={styles.inner}>
          <div className={styles.header}>
            <div>
              <div className={styles.title}>Business Assessment</div>
              <div className={styles.subtitle}>
                Help us understand where your business is at and where you want to go.
              </div>
            </div>
          </div>

          <div className={styles.stepper}>
            {Array.from({ length: total }).map((_, i) => {
              const idx = i + 1;
              const done = idx < step;
              const active = idx === step;
              return (
                <div key={idx} className={styles.stepItem}>
                  <div className={`${styles.stepDot} ${done ? styles.done : ""} ${active ? styles.active : ""}`}>
                    {done ? "✓" : idx}
                  </div>
                  {idx !== total && <div className={styles.stepLine} />}
                </div>
              );
            })}
          </div>

          <div className={styles.body}>
            {/* ✅ Thank-you popup view (shown after successful submit) */}
            {submitted ? (
              <div style={{ textAlign: "center", padding: "26px 10px" }}>
                <h3 className={styles.h3} style={{ marginTop: 0 }}>
                  Thank you for your submission!
                </h3>
                <p className={styles.helper} style={{ marginTop: 8 }}>
                  We received your assessment. You can close this window or return home.
                </p>

                
              </div>
            ) : (
              <>
                {step === 1 && (
                  <>
                    <h3 className={styles.h3}>Contact Information</h3>

                    <div className={styles.grid2}>
                      <div className={styles.field}>
                        <label className={styles.label}>Full Name *</label>
                        <input
                          className={styles.input}
                          value={data.fullName}
                          onChange={(e) => setData((d) => ({ ...d, fullName: e.target.value }))}
                          placeholder="John Doe"
                          autoComplete="name"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Email *</label>
                        <input
                          className={styles.input}
                          value={data.email}
                          onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))}
                          placeholder="john@example.com"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Phone *</label>
                        <input
                          className={styles.input}
                          value={data.phone}
                          onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))}
                          placeholder="+1 (555) 000-0000"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Company Name</label>
                        <input
                          className={styles.input}
                          value={data.companyName}
                          onChange={(e) => setData((d) => ({ ...d, companyName: e.target.value }))}
                          placeholder="Acme Inc."
                          autoComplete="organization"
                        />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Current Website (if any)</label>
                      <input
                        className={styles.input}
                        value={data.currentWebsite}
                        onChange={(e) => setData((d) => ({ ...d, currentWebsite: e.target.value }))}
                        placeholder="https://example.com"
                        inputMode="url"
                        autoComplete="url"
                      />
                    </div>

                    <div className={styles.consentBox}>
                      <div className={styles.consentTitle}>Communication Preferences *</div>

                      <label className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={data.callbackOptIn}
                          onChange={(e) => setData((d) => ({ ...d, callbackOptIn: e.target.checked }))}
                        />
                        <span>Yes — I want a call/text back about my assessment.</span>
                      </label>

                      <label className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={data.smsTransactionalOptIn}
                          onChange={(e) => setData((d) => ({ ...d, smsTransactionalOptIn: e.target.checked }))}
                        />
                        <span>
                          I consent to receive transactional SMS (appointments/updates). Msg & data rates may apply.
                        </span>
                      </label>

                      <label className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={data.smsMarketingOptIn}
                          onChange={(e) => setData((d) => ({ ...d, smsMarketingOptIn: e.target.checked }))}
                        />
                        <span>
                          I consent to receive marketing/promotional SMS. Msg & data rates may apply.
                        </span>
                      </label>

                      <div className={styles.consentFine}>Reply HELP for help or STOP to opt-out.</div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className={styles.blockHead}>
                      <div className={styles.blockIcon}>🔎</div>
                      <div>
                        <div className={styles.blockTitle}>Findability</div>
                        <div className={styles.blockSub}>Website, SEO & Google My Business</div>
                      </div>
                    </div>

                    <div className={styles.box}>
                      <div className={styles.boxTitle}>What do you already have?</div>

                      {["I have a website", "I have a Google My Business profile", "I'm actively doing SEO / content marketing"].map(
                        (t) => (
                          <label key={t} className={styles.checkRow}>
                            <input
                              type="checkbox"
                              checked={data.find_have.includes(t)}
                              onChange={() => setData((d) => ({ ...d, find_have: toggleInArray(d.find_have, t) }))}
                            />
                            <span>{t}</span>
                          </label>
                        )
                      )}
                    </div>

                    <div className={styles.box}>
                      <div className={styles.boxTitle}>What do you need help with?</div>

                      {[
                        "I need help with all of these",
                        "Website (new or improvements)",
                        "Google My Business setup/optimization",
                        "SEO / content marketing help",
                      ].map((t) => (
                        <label key={t} className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={data.find_need.includes(t)}
                            onChange={() => setData((d) => ({ ...d, find_need: toggleInArray(d.find_need, t) }))}
                          />
                          <span>{t}</span>
                        </label>
                      ))}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Additional details about your findability needs</label>
                      <textarea
                        className={styles.textarea}
                        value={data.find_notes}
                        onChange={(e) => setData((d) => ({ ...d, find_notes: e.target.value }))}
                        placeholder="e.g., Looking to rank for specific keywords, need a redesign..."
                      />
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div className={styles.blockHead}>
                      <div className={styles.blockIcon}>📩</div>
                      <div>
                        <div className={styles.blockTitle}>Lead Capture</div>
                        <div className={styles.blockSub}>CRM, AI Chatbots & Voicemail Agents</div>
                      </div>
                    </div>

                    <div className={styles.box}>
                      <div className={styles.boxTitle}>What do you already have?</div>

                      {[
                        "I use a CRM to manage leads/customers",
                        "I have a chatbot or live chat on my website",
                        "I have automated voicemail or call handling",
                      ].map((t) => (
                        <label key={t} className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={data.lead_have.includes(t)}
                            onChange={() => setData((d) => ({ ...d, lead_have: toggleInArray(d.lead_have, t) }))}
                          />
                          <span>{t}</span>
                        </label>
                      ))}
                    </div>

                    <div className={styles.box}>
                      <div className={styles.boxTitle}>What do you need help with?</div>

                      {[
                        "I need help with all of these",
                        "CRM to manage leads/customers",
                        "AI chatbot or live chat",
                        "Automated voicemail or call handling",
                      ].map((t) => (
                        <label key={t} className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={data.lead_need.includes(t)}
                            onChange={() => setData((d) => ({ ...d, lead_need: toggleInArray(d.lead_need, t) }))}
                          />
                          <span>{t}</span>
                        </label>
                      ))}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Additional details about your lead capture needs</label>
                      <textarea
                        className={styles.textarea}
                        value={data.lead_notes}
                        onChange={(e) => setData((d) => ({ ...d, lead_notes: e.target.value }))}
                        placeholder="e.g., Missing calls after hours, want a better intake..."
                      />
                    </div>
                  </>
                )}

                {step === 4 && (
                  <>
                    <div className={styles.blockHead}>
                      <div className={styles.blockIcon}>⚙️</div>
                      <div>
                        <div className={styles.blockTitle}>Operational Leverage</div>
                        <div className={styles.blockSub}>Custom Software, AI Agents & Automation</div>
                      </div>
                    </div>

                    <div className={styles.box}>
                      <div className={styles.boxTitle}>What do you already have?</div>

                      {[
                        "I use workflow automation (Zapier, Make, etc.)",
                        "I have custom software/internal tools",
                        "I use AI agents or AI-powered tools",
                      ].map((t) => (
                        <label key={t} className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={data.ops_have.includes(t)}
                            onChange={() => setData((d) => ({ ...d, ops_have: toggleInArray(d.ops_have, t) }))}
                          />
                          <span>{t}</span>
                        </label>
                      ))}
                    </div>

                    <div className={styles.box}>
                      <div className={styles.boxTitle}>What do you need help with?</div>

                      {[
                        "I need help with all of these",
                        "Workflow automation (Zapier, Make, etc.)",
                        "Custom software/internal tools",
                        "AI agents or AI-powered tools",
                      ].map((t) => (
                        <label key={t} className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={data.ops_need.includes(t)}
                            onChange={() => setData((d) => ({ ...d, ops_need: toggleInArray(d.ops_need, t) }))}
                          />
                          <span>{t}</span>
                        </label>
                      ))}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Additional details about your operational needs</label>
                      <textarea
                        className={styles.textarea}
                        value={data.ops_notes}
                        onChange={(e) => setData((d) => ({ ...d, ops_notes: e.target.value }))}
                        placeholder="e.g., Repetitive tasks you want automated, internal tools ideas..."
                      />
                    </div>
                  </>
                )}

                {step === 5 && (
                  <>
                    <h3 className={styles.h3}>Final Notes</h3>
                    <p className={styles.helper}>Any final thoughts or anything we should know about your business?</p>

                    <div className={styles.field}>
                      <label className={styles.label}>Final thoughts</label>
                      <textarea
                        className={styles.textarea}
                        value={data.final_notes}
                        onChange={(e) => setData((d) => ({ ...d, final_notes: e.target.value }))}
                        placeholder="Type here..."
                      />
                    </div>

                    <div className={styles.submitHint}>
                      When you submit, we’ll review your answers and reach out based on your preferences.
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* ✅ Hide footer when submitted, so the popup is clean */}
          {!submitted && (
            <div className={styles.footer}>
              <button
                className={styles.back}
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1 || submitting}
              >
                ← Back
              </button>

              {step < total ? (
                <button
                  className={styles.next}
                  type="button"
                  onClick={() => canNext && setStep((s) => Math.min(total, s + 1))}
                  disabled={!canNext || submitting}
                >
                  Next →
                </button>
              ) : (
                <button className={styles.next} type="button" onClick={submit} disabled={submitting || !canNext}>
                  {submitting ? "Submitting..." : "Submit →"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}