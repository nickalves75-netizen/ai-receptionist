"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./sales-studio.module.css";

type LeadType = "WOM" | "Referral" | "Sales Canvassing";

export default function SalesStudioPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [industry, setIndustry] = useState("");
  const [leadType, setLeadType] = useState<LeadType>("WOM");
  const [referralName, setReferralName] = useState("");
  const [repName, setRepName] = useState("");

  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsReferralName = leadType === "Referral";

  const canSubmit = useMemo(() => {
    const base =
      companyName.trim().length > 1 &&
      phone.trim().length > 6 &&
      email.trim().length > 4 &&
      industry.trim().length > 1 &&
      repName.trim().length > 1;

    if (!base) return false;
    if (needsReferralName) return referralName.trim().length > 1;
    return true;
  }, [companyName, phone, email, industry, repName, needsReferralName, referralName]);

  async function onCreateLead(e: React.FormEvent) {
    e.preventDefault();
    setSubmitErr(null);

    if (!canSubmit) {
      setSubmitErr("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        source: leadType,
        data: {
          companyName: companyName.trim(),
          fullName: contactName.trim() || null,
          phone: phone.trim(),
          email: email.trim(),
          industry: industry.trim(),
          leadType,
          referralName: needsReferralName ? referralName.trim() : null,
          repName: repName.trim(),
          createdFrom: "sales_studio",
        },
      };

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        const msg = data?.error || `Lead creation failed (${res.status}).`;
        throw new Error(msg);
      }

      const id = String(data?.id || "").trim();
      if (!id) throw new Error("Lead created, but no lead id was returned.");

      // ✅ NEW: go into the proposal/discovery presentation funnel
      router.push(`/internal/proposals/${encodeURIComponent(id)}`);
    } catch (err: any) {
      setSubmitErr(err?.message ? String(err.message) : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.bg} aria-hidden="true" />

      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.hero}>
            <div className={styles.heroLogo} aria-hidden="true">
              <Image
                src="/neais-logo.png"
                alt=""
                width={92}
                height={92}
                priority
                className={styles.logo}
              />
            </div>
            <h1 className={styles.h1}>Sales Studio</h1>
          </div>
        </header>

        <section className={styles.card}>
          <form className={styles.form} onSubmit={onCreateLead}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="companyName">
                  Company name <span className={styles.req}>*</span>
                </label>
                <input
                  id="companyName"
                  className={styles.input}
                  placeholder="Company LLC"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoComplete="organization"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="industry">
                  Industry <span className={styles.req}>*</span>
                </label>
                <input
                  id="industry"
                  className={styles.input}
                  placeholder="e.g. Dental, HVAC, Auto Service"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="contactName">
                  Contact name
                </label>
                <input
                  id="contactName"
                  className={styles.input}
                  placeholder="Decision maker"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="repName">
                  Kallr representative <span className={styles.req}>*</span>
                </label>
                <input
                  id="repName"
                  className={styles.input}
                  placeholder="Your name"
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="phone">
                  Phone <span className={styles.req}>*</span>
                </label>
                <input
                  id="phone"
                  className={styles.input}
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">
                  Email <span className={styles.req}>*</span>
                </label>
                <input
                  id="email"
                  className={styles.input}
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="leadType">
                  Type of lead <span className={styles.req}>*</span>
                </label>
                <select
                  id="leadType"
                  className={styles.select}
                  value={leadType}
                  onChange={(e) => setLeadType(e.target.value as LeadType)}
                >
                  <option value="WOM">Word of mouth</option>
                  <option value="Referral">Referral</option>
                  <option value="Sales Canvassing">Sales canvassing</option>
                </select>
              </div>

              <div
                className={`${styles.field} ${styles.reveal} ${
                  needsReferralName ? styles.revealOn : styles.revealOff
                }`}
                aria-hidden={!needsReferralName}
              >
                <label className={styles.label} htmlFor="referralName">
                  Referral name <span className={styles.req}>*</span>
                </label>
                <input
                  id="referralName"
                  className={styles.input}
                  placeholder="Who referred them?"
                  value={referralName}
                  onChange={(e) => setReferralName(e.target.value)}
                  required={needsReferralName}
                  tabIndex={needsReferralName ? 0 : -1}
                />
              </div>

              <div className={styles.fullRow}>
                {submitErr ? <div className={styles.err}>{submitErr}</div> : null}

                <div className={styles.btnWrap}>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={!canSubmit || submitting}
                  >
                    {submitting ? "Starting..." : "Start New Proposal"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}