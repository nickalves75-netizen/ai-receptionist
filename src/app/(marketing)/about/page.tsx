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
            <div className={styles.pill}>About Kallr</div>

            <h1 className={styles.h1}>
              Your AI Reception Partner
            </h1>

            <p className={styles.subhead}>
              We help businesses capture inbound demand, qualify leads consistently, and book the next step—without adding headcount.
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
                <div className={styles.metricBot}>Lead response</div>
              </div>
            </Reveal>
            <Reveal as="div" delayMs={160}>
              <div className={styles.metric}>
                <div className={styles.metricTop}>Clean</div>
                <div className={styles.metricBot}>Intake + notes</div>
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
                Kallr started with a simple observation: businesses weren’t losing leads because they were bad at what they do—
                they were losing leads because they couldn’t respond fast enough.
              </p>
              <ul className={styles.checkList}>
                <li>Calls went to voicemail after hours</li>
                <li>Follow-up depended on “who remembered”</li>
                <li>Intake questions changed day-to-day</li>
                <li>Great leads slipped through cracks</li>
              </ul>
              <p className={styles.sectionSub} style={{ textAlign: "left", marginTop: 12 }}>
                We built Kallr to make intake consistent: answer instantly, qualify cleanly, and route the next step—every time.
              </p>
            </Reveal>

            <Reveal as="div" delayMs={120} className={styles.panel}>
              <h3 className={styles.panelTitle}>Why Choose Us</h3>
              <ul className={styles.checkList}>
                <li>Built for service businesses—not enterprise complexity</li>
                <li>Conversion-first flows that prioritize booked outcomes</li>
                <li>Human-sounding experience with smart routing</li>
                <li>Transparent process: launch, tune, improve</li>
                <li>Ongoing optimization so performance doesn’t drift</li>
              </ul>
              <div className={styles.panelFoot}>
                <span className={styles.panelFootStrong}>Simple wins.</span> Fast response + consistent intake.
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
            <p className={styles.sectionSub}>These principles guide how we build and support every Kallr deployment.</p>
          </Reveal>

          <div className={styles.grid4}>
            <Reveal as="div" delayMs={110} className={styles.card}>
              <div className={styles.cardIcon}>🎯</div>
              <h3 className={styles.cardTitle}>Results-Focused</h3>
              <p className={styles.cardText}>We care about booked outcomes: answered calls, qualified leads, scheduled next steps.</p>
            </Reveal>

            <Reveal as="div" delayMs={150} className={styles.card}>
              <div className={styles.cardIcon}>⚙️</div>
              <h3 className={styles.cardTitle}>Operational Simplicity</h3>
              <p className={styles.cardText}>Clean workflows your team can actually run. No messy handoffs or hidden complexity.</p>
            </Reveal>

            <Reveal as="div" delayMs={190} className={styles.card}>
              <div className={styles.cardIcon}>🤝</div>
              <h3 className={styles.cardTitle}>Partnership</h3>
              <p className={styles.cardText}>We deploy, support, and improve—so your intake stays sharp as you grow.</p>
            </Reveal>

            <Reveal as="div" delayMs={230} className={styles.card}>
              <div className={styles.cardIcon}>🧠</div>
              <h3 className={styles.cardTitle}>Continuous Improvement</h3>
              <p className={styles.cardText}>We tune the conversation and follow-up so performance keeps getting better over time.</p>
            </Reveal>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
