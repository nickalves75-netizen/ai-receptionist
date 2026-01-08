"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import styles from "@/app/(marketing)/page.module.css";
import { LeadCtaButton } from "@/components/marketing/lead/LeadCtaButton";
import LeadFormModal from "@/components/marketing/lead/LeadFormModal";
import Reveal from "@/components/marketing/motion/Reveal";
import PersonaSection from "@/components/marketing/PersonaSection";

export default function MarketingLanding(props: {
  pill: string;
  title: ReactNode;
  subhead?: string;
  sourcePrefix: string;

  // If provided, we replace the “Why Choose Kallr?” section with this persona section.
  persona?: {
    persona: "male" | "female";
    kicker?: string;
    title?: string;
    body?: string;
    bullets?: string[];
  };
}) {
  const subhead =
    props.subhead ??
    "NEAIS answers calls instantly, qualifies leads, and books the next step—so you never lose business to missed calls.";

  // Step 2: open the assessment modal from CTAs (no navigation)
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSource, setLeadSource] = useState(`${props.sourcePrefix}-hero`);

  function openLead(source: string) {
    setLeadSource(source);
    setLeadOpen(true);
  }

  function ctaCapture(source: string) {
    return (e: any) => {
      // Works whether LeadCtaButton renders a <button> or <a>
      if (e?.preventDefault) e.preventDefault();
      if (e?.stopPropagation) e.stopPropagation();
      openLead(source);
    };
  }

  return (
    <div className={styles.page}>
      {/* HERO */}
      <Reveal as="section" className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroInner}>
            <div className={styles.pill}>{props.pill}</div>
            <h1 className={styles.h1}>{props.title}</h1>

            <p className={styles.subhead}>{subhead}</p>

            <div className={styles.heroCtas}>
              <span onClickCapture={ctaCapture(`${props.sourcePrefix}-hero`)}>
                <LeadCtaButton
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  source={`${props.sourcePrefix}-hero`}
                >
                  Get Started
                </LeadCtaButton>
              </span>

              <a className={`${styles.btn} ${styles.btnOutline}`} href="/case-studies">
                View Case Studies
              </a>
            </div>
          </div>
        </div>
      </Reveal>

      <div className={styles.divider} />

      {/* OUR SOLUTIONS */}
      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <Reveal as="div" delayMs={60}>
            <h2 className={styles.h2}>Our Solutions</h2>
            <p className={styles.sectionSub}>
              A clean, conversion-focused system that turns inbound interest into booked revenue.
            </p>
          </Reveal>

          <div className={styles.grid4}>
            <Reveal as="div" delayMs={80} className={styles.card}>
              <div className={styles.cardIcon}>☎️</div>
              <h3 className={styles.cardTitle}>AI Phone Receptionist</h3>
              <p className={styles.cardText}>Answer calls, qualify leads, and book next steps—instantly.</p>
              <ul className={styles.list}>
                <li>24/7 answering</li>
                <li>Lead qualification</li>
                <li>Booking + routing</li>
                <li>SMS follow-ups</li>
              </ul>

              <span onClickCapture={ctaCapture(`${props.sourcePrefix}-solutions-phone`)}>
                <LeadCtaButton className={styles.cardBtn} source={`${props.sourcePrefix}-solutions-phone`}>
                  Learn more →
                </LeadCtaButton>
              </span>
            </Reveal>

            <Reveal as="div" delayMs={150} className={styles.card}>
              <div className={styles.cardIcon}>🔎</div>
              <h3 className={styles.cardTitle}>SEO Services</h3>
              <p className={styles.cardText}>
                Rank for real intent and turn clicks into calls with clean local SEO foundations.
              </p>
              <ul className={styles.list}>
                <li>Local SEO</li>
                <li>Content pages</li>
                <li>Technical fixes</li>
                <li>Reporting</li>
              </ul>

              <span onClickCapture={ctaCapture(`${props.sourcePrefix}-solutions-seo`)}>
                <LeadCtaButton className={styles.cardBtn} source={`${props.sourcePrefix}-solutions-seo`}>
                  Learn more →
                </LeadCtaButton>
              </span>
            </Reveal>

            <Reveal as="div" delayMs={220} className={styles.card}>
              <div className={styles.cardIcon}>💬</div>
              <h3 className={styles.cardTitle}>AI SMS Automations</h3>
              <p className={styles.cardText}>Convert missed calls and inbound leads with instant text workflows.</p>
              <ul className={styles.list}>
                <li>Missed call text-back</li>
                <li>Lead nurture sequences</li>
                <li>Smart reminders</li>
                <li>Owner alerts</li>
              </ul>

              <span onClickCapture={ctaCapture(`${props.sourcePrefix}-solutions-sms`)}>
                <LeadCtaButton className={styles.cardBtn} source={`${props.sourcePrefix}-solutions-sms`}>
                  Run assessment →
                </LeadCtaButton>
              </span>
            </Reveal>

            <Reveal as="div" delayMs={290} className={styles.card}>
              <div className={styles.cardIcon}>🔌</div>
              <h3 className={styles.cardTitle}>Seamless Integrations</h3>
              <p className={styles.cardText}>
                Simple workflows that connect your tools—without operational chaos.
              </p>
              <ul className={styles.list}>
                <li>CRM + calendars</li>
                <li>Forms + websites</li>
                <li>Call summaries</li>
                <li>Visibility</li>
              </ul>

              <span onClickCapture={ctaCapture(`${props.sourcePrefix}-solutions-integrations`)}>
                <LeadCtaButton className={styles.cardBtn} source={`${props.sourcePrefix}-solutions-integrations`}>
                  See what’s possible →
                </LeadCtaButton>
              </span>
            </Reveal>
          </div>
        </div>
      </Reveal>

      <div className={styles.divider} />

      {/* TRANSFORMATION */}
      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <Reveal as="div" delayMs={60}>
            <h2 className={styles.h2}>Transformation</h2>
            <p className={styles.sectionSub}>
              See how NEAIS turns missed calls and slow follow-up into a streamlined lead system.
            </p>
          </Reveal>

          <div className={styles.split}>
            <Reveal as="div" delayMs={90} className={`${styles.panel} ${styles.panelDark}`}>
              <h3 className={styles.panelTitle}>Before</h3>
              <p className={styles.panelTagBad}>Missed opportunities & inconsistent call flow </p>
              <ul className={styles.checkList}>
                <li>Calls go to voicemail</li>
                <li>Slow or inconsistent follow-up</li>
                <li>Appointments slip through</li>
              </ul>
            </Reveal>

            <Reveal as="div" delayMs={140} className={styles.panel}>
              <h3 className={styles.panelTitle}>After</h3>
              <p className={styles.panelTagGood}>Streamlined lead capture & a perfect inboud worklow. </p>
              <ul className={styles.checkList}>
                <li>Calls answered instantly</li>
                <li>Leads qualified consistently</li>
                <li>Bookings + routing automated</li>
                <li>Faster response across channels</li>
                <li>Make scaling feel seamless</li>
              </ul>

              <div className={styles.panelFoot}>
                <span className={styles.panelFootStrong}>Built for speed.</span> Not hype—just a cleaner conversion path.
              </div>
            </Reveal>
          </div>

          <div className={styles.metrics}>
            <Reveal as="div" delayMs={120}>
              <span onClickCapture={ctaCapture(`${props.sourcePrefix}-metric-247`)}>
                <LeadCtaButton className={styles.metric} source={`${props.sourcePrefix}-metric-247`}>
                  <div className={styles.metricTop}>24/7</div>
                  <div className={styles.metricBot}>Calls answered</div>
                </LeadCtaButton>
              </span>
            </Reveal>

            <Reveal as="div" delayMs={180}>
              <span onClickCapture={ctaCapture(`${props.sourcePrefix}-metric-faster`)}>
                <LeadCtaButton className={styles.metric} source={`${props.sourcePrefix}-metric-faster`}>
                  <div className={styles.metricTop}>Faster</div>
                  <div className={styles.metricBot}>Lead response</div>
                </LeadCtaButton>
              </span>
            </Reveal>

            <Reveal as="div" delayMs={240}>
              <span onClickCapture={ctaCapture(`${props.sourcePrefix}-metric-less`)}>
                <LeadCtaButton className={styles.metric} source={`${props.sourcePrefix}-metric-less`}>
                  <div className={styles.metricTop}>Less</div>
                  <div className={styles.metricBot}>Admin work</div>
                </LeadCtaButton>
              </span>
            </Reveal>

            <Reveal as="div" delayMs={300}>
              <span onClickCapture={ctaCapture(`${props.sourcePrefix}-metric-more`)}>
                <LeadCtaButton className={styles.metric} source={`${props.sourcePrefix}-metric-more`}>
                  <div className={styles.metricTop}>More</div>
                  <div className={styles.metricBot}>Booked jobs</div>
                </LeadCtaButton>
              </span>
            </Reveal>
          </div>
        </div>
      </Reveal>

      {/* Persona OR Why Choose */}
      {props.persona ? (
        <PersonaSection {...props.persona} />
      ) : (
        <Reveal as="section" className={`${styles.section} ${styles.whySection}`} delayMs={40}>
          <div className={styles.container}>
            <Reveal as="div" delayMs={60}>
              <h2 className={styles.h2}>Why Choose NEAIS?</h2>
              <p className={styles.sectionSub}>
                A clean system that answers, qualifies, and converts—without adding headcount.
              </p>
            </Reveal>

            <div className={styles.whyGrid}>
              <Reveal as="div" delayMs={90} className={styles.whyCard}>
                <div className={styles.whyIcon}>🎧</div>
                <h3 className={styles.whyTitle}>Best Support in the Industry</h3>
                <p className={styles.whyText}>
                  We help you launch, tune your intake, and keep performance improving—fast.
                </p>
              </Reveal>

              <Reveal as="div" delayMs={140} className={styles.whyTall}>
                <div className={styles.whyTallBadge}>Built for conversions</div>
                <h3 className={styles.whyTallTitle}>A Simple Intake That Actually Closes</h3>
                <p className={styles.whyTallText}>
                  One assessment flow across your site and pages—consistent data in, consistent follow-up out.
                </p>
                <div className={styles.whyTallMiniRow}>
                  <div className={styles.whyTallMini}>Instant call handling</div>
                  <div className={styles.whyTallMini}>Unified lead notes</div>
                </div>
              </Reveal>

              <Reveal as="div" delayMs={190} className={styles.whyCard}>
                <div className={styles.whyIcon}>🧩</div>
                <h3 className={styles.whyTitle}>Personalized to Your Business</h3>
                <p className={styles.whyText}>Your questions, your routing rules, your follow-up—built around how you sell.</p>
              </Reveal>

              <Reveal as="div" delayMs={240} className={styles.whyCard}>
                <div className={styles.whyIcon}>📈</div>
                <h3 className={styles.whyTitle}>Guaranteed ROI Focus</h3>
                <p className={styles.whyText}>
                  We prioritize the highest-impact improvements: answered calls, faster response, more bookings.
                </p>
              </Reveal>
            </div>
          </div>
        </Reveal>
      )}

      <div className={styles.divider} />

      {/* FINAL CTA */}
      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <Reveal as="div" delayMs={80} className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Ready to capture more leads automatically?</h2>
            <p className={styles.ctaText}>
              Take the NEAIS assessment. We’ll map the fastest path to better lead capture, call handling, and local
              visibility.
            </p>

            <div className={styles.ctaRow}>
              <span onClickCapture={ctaCapture(`${props.sourcePrefix}-bottom`)}>
                <LeadCtaButton className={`${styles.btn} ${styles.btnPrimary}`} source={`${props.sourcePrefix}-bottom`}>
                  Start Assessment
                </LeadCtaButton>
              </span>

              <a className={`${styles.btn} ${styles.btnOutline}`} href="/contact">
                Talk to us
              </a>
            </div>
          </Reveal>
        </div>
      </Reveal>

      {/* Step 2 modal mount */}
      <LeadFormModal open={leadOpen} onClose={() => setLeadOpen(false)} source={leadSource} />
    </div>
  );
}
