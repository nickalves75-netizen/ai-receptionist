import styles from "@/app/(marketing)/page.module.css";
import Reveal from "@/components/marketing/motion/Reveal";
import RoadmapTimeline from "@/components/marketing/RoadmapTimeline";

export default function AboutPage() {
  return (
    <div className={styles.page}>
      {/* HERO (no CTAs, per your request) */}
      <Reveal as="section" className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroInner}>
            <div className={styles.pill}>About NEAIS</div>

            <h1 className={styles.h1}>New England AI, built for real business.</h1>

            <p className={styles.subhead}>
              NEAIS helps service businesses turn attention into action—answer calls instantly, handle messages, improve web
              conversions, automate follow-up, and keep operations consistent without adding headcount.
            </p>

            <div className={styles.sectionSub} style={{ marginTop: 10 }}>
              Headquartered in New England • Serving nationwide
            </div>
          </div>
        </div>
      </Reveal>

      {/* Roadmap path section (animated as you scroll) */}
      <RoadmapTimeline />

      <div className={styles.divider} />

      {/* Metrics row (same “card” vibe, light theme) */}
      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <div className={styles.metrics}>
            <Reveal as="div" delayMs={80}>
              <div className={styles.metric}>
                <div className={styles.metricTop}>24/7</div>
                <div className={styles.metricBot}>Always-on coverage</div>
              </div>
            </Reveal>
            <Reveal as="div" delayMs={120}>
              <div className={styles.metric}>
                <div className={styles.metricTop}>Faster</div>
                <div className={styles.metricBot}>Response time</div>
              </div>
            </Reveal>
            <Reveal as="div" delayMs={160}>
              <div className={styles.metric}>
                <div className={styles.metricTop}>Clean</div>
                <div className={styles.metricBot}>Intake + routing</div>
              </div>
            </Reveal>
            <Reveal as="div" delayMs={200}>
              <div className={styles.metric}>
                <div className={styles.metricTop}>More</div>
                <div className={styles.metricBot}>Booked revenue</div>
              </div>
            </Reveal>
          </div>
        </div>
      </Reveal>

      <div className={styles.divider} />

      {/* Our Story + Why Choose (two-column) */}
      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <div className={styles.split}>
            <Reveal as="div" delayMs={80} className={styles.panel}>
              <h3 className={styles.panelTitle}>Our Story</h3>
              <p className={styles.sectionSub} style={{ textAlign: "left", marginTop: 8 }}>
                NEAIS started with a simple pattern we kept seeing across New England: great businesses were losing revenue
                in the gaps—between calls, texts, websites, and follow-up.
              </p>
              <ul className={styles.checkList}>
                <li>Calls went to voicemail after hours (or during busy hours)</li>
                <li>Text/message replies were inconsistent and delayed</li>
                <li>Website forms collected leads, but nothing happened next</li>
                <li>Intake questions changed day-to-day, so details were missed</li>
                <li>Marketing spend brought traffic, but conversions leaked</li>
              </ul>
              <p className={styles.sectionSub} style={{ textAlign: "left", marginTop: 12 }}>
                We built NEAIS to make the entire front door consistent: <b>AI for Calls</b>, <b>AI for Messages</b>,{" "}
                <b>AI for Websites</b>, <b>AI for Marketing</b>, and <b>AI for Automation</b>—plus practical{" "}
                <b>AI Consultations</b> to map the right system for each business.
              </p>
            </Reveal>

            <Reveal as="div" delayMs={120} className={styles.panel}>
              <h3 className={styles.panelTitle}>Why Choose Us</h3>
              <ul className={styles.checkList}>
                <li>Built for service businesses—simple, fast, and conversion-first</li>
                <li>Local-first mindset with nationwide implementation support</li>
                <li>Clear outcomes: answered calls, qualified leads, booked next steps</li>
                <li>Launch, tune, improve—no “set it and forget it” drift</li>
                <li>Clean handoffs to your team with notes, summaries, and routing</li>
              </ul>
              <div className={styles.panelFoot}>
                <span className={styles.panelFootStrong}>Practical AI.</span> Real workflows that increase revenue and reduce
                busywork.
              </div>
            </Reveal>
          </div>
        </div>
      </Reveal>

      <div className={styles.divider} />

      {/* Values (4 cards) */}
      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <Reveal as="div" delayMs={70}>
            <h2 className={styles.h2}>Our Values</h2>
            <p className={styles.sectionSub}>
              These principles guide how we build and support every NEAIS implementation.
            </p>
          </Reveal>

          <div className={styles.grid4}>
            <Reveal as="div" delayMs={110} className={styles.card}>
              <div className={styles.cardIcon}>🎯</div>
              <h3 className={styles.cardTitle}>Outcome-Driven</h3>
              <p className={styles.cardText}>
                We measure what matters: answered calls, qualified conversations, scheduled next steps, and revenue impact.
              </p>
            </Reveal>

            <Reveal as="div" delayMs={150} className={styles.card}>
              <div className={styles.cardIcon}>⚙️</div>
              <h3 className={styles.cardTitle}>Operational Clarity</h3>
              <p className={styles.cardText}>
                Systems your team can run with confidence—clean intake, consistent routing, and easy-to-follow processes.
              </p>
            </Reveal>

            <Reveal as="div" delayMs={190} className={styles.card}>
              <div className={styles.cardIcon}>🤝</div>
              <h3 className={styles.cardTitle}>Partnership</h3>
              <p className={styles.cardText}>
                We stay involved: deployment, support, and optimization so performance stays sharp as you grow.
              </p>
            </Reveal>

            <Reveal as="div" delayMs={230} className={styles.card}>
              <div className={styles.cardIcon}>🧠</div>
              <h3 className={styles.cardTitle}>Continuous Improvement</h3>
              <p className={styles.cardText}>
                We refine messaging, logic, and automation over time—because the best systems get better every week.
              </p>
            </Reveal>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
