import styles from "@/app/(marketing)/page.module.css";
import Reveal from "@/components/marketing/motion/Reveal";
import { LeadCtaButton } from "@/components/marketing/lead/LeadCtaButton";

const quotes = [
  {
    location: "Boston, MA",
    name: "Jordan K.",
    title: "Operations Manager",
    company: "Beacon Home Pros",
    quote:
      "Honestly, the biggest thing was peace of mind. Calls stopped slipping through the cracks, and we weren’t playing catch-up every morning. It just… started running smoother.",
    stat: "+60%",
    statLabel: "booking flow",
    highlights: ["Fewer missed calls", "Cleaner intake", "Less morning backlog"],
  },
  {
    location: "Providence, RI",
    name: "Melissa R.",
    title: "Owner",
    company: "Ocean State Auto Care",
    quote:
      "The texts surprised me. People who used to ghost actually replied. It felt like we finally had a real system instead of ‘hope they call back.’",
    stat: "+40%",
    statLabel: "call efficiency",
    highlights: ["More replies", "Faster follow-up", "Higher show-rate"],
  },
  {
    location: "Hartford, CT",
    name: "Anthony D.",
    title: "General Manager",
    company: "Capitol Contractors Group",
    quote:
      "We didn’t change anything else—just added Kallr. Within a couple weeks we could literally see the difference in our schedule. Less chaos, better handoffs.",
    stat: "+220%",
    statLabel: "lead capture",
    highlights: ["Better handoffs", "More booked jobs", "Less chaos"],
  },
];

export default function QuotesPage() {
  return (
    <div className={styles.page}>
      {/* HERO */}
      <section
        className={styles.hero}
        style={{
          backgroundImage:
  "linear-gradient(180deg, var(--k-hero-a), var(--k-hero-b)), url('/neais-logo.png')",


          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Reveal as="div">
          <div className={styles.container}>
            <div className={styles.heroInner}>
              <div className={styles.pill}>Quotes</div>

              <h1 className={styles.h1}>
                Quick Notes From Teams <span className={styles.accent}>Using Kallr</span>
              </h1>

              <p className={styles.subhead}>
                Real reactions from businesses across New England—less fluff, more “what actually changed.”
              </p>

              <div className={styles.heroCtas}>
                <LeadCtaButton className={`${styles.btn} ${styles.btnPrimary}`} source="quotes-hero">
                  Get Started
                </LeadCtaButton>

                <a className={`${styles.btn} ${styles.btnOutline}`} href="/contact">
                  Talk to us
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <div className={styles.divider} />

      {/* QUOTES */}
      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <Reveal as="div" delayMs={60}>
            <h2 className={styles.h2}>Client quotes</h2>
            <p className={styles.sectionSub}>Short, honest feedback—no case-study energy.</p>
          </Reveal>

          <div
            className={styles.grid4}
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" as any }}
          >
            {quotes.map((q, idx) => (
              <Reveal
                key={q.location}
                as="div"
                delayMs={90 + idx * 70}
                className={styles.card}
                // allows bottom-right stat badge positioning without touching CSS files
                style={{ position: "relative" } as any}
              >
                <div className={styles.pill} style={{ width: "fit-content", marginBottom: 10 }}>
                  {q.location}
                </div>

                <p className={styles.cardText} style={{ textAlign: "center", fontSize: 15 }}>
                  “{q.quote}”
                </p>

                <p className={styles.cardText} style={{ textAlign: "center", marginTop: 10 }}>
                  <strong>{q.name}</strong> • {q.title} •{" "}
                  <span className={styles.accent}>{q.company}</span>
                </p>

                <ul className={styles.list} style={{ marginTop: 10 }}>
                  {q.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>

                {/* Bottom-right stat box */}
                <div
                  style={{
                    position: "absolute",
                    right: 14,
                    bottom: 14,
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "var(--k-card)",
border: "1px solid var(--k-border)",
boxShadow: "var(--k-shadow2)",
color: "var(--k-text)",

                    textAlign: "right",
                    minWidth: 110,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>
                    {q.stat}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>
                    {q.statLabel}
                  </div>
                </div>

                <LeadCtaButton className={styles.cardBtn} source={`quotes-${q.location}`}>
                  Run assessment →
                </LeadCtaButton>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>

      <div className={styles.divider} />

      {/* FINAL CTA */}
      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <Reveal as="div" delayMs={80} className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Want a similar outcome?</h2>
            <p className={styles.ctaText}>
              Run the Kallr assessment—then we’ll map the cleanest path to better calls, better follow-up,
              and more bookings.
            </p>

            <div className={styles.ctaRow}>
              <LeadCtaButton className={`${styles.btn} ${styles.btnPrimary}`} source="quotes-bottom">
                Start Assessment
              </LeadCtaButton>

              <a className={`${styles.btn} ${styles.btnOutline}`} href="/contact">
                Talk to us
              </a>
            </div>
          </Reveal>
        </div>
      </Reveal>
    </div>
  );
}
