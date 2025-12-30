import Link from "next/link";
import styles from "@/app/(marketing)/page.module.css";
import Reveal from "@/components/marketing/motion/Reveal";

export default function BlogPost() {
  return (
    <div className={styles.page}>
      <Reveal as="section" className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroInner}>
            <div className={styles.pill}>Blog • Dec 2024 • 7 min read</div>
            <h1 className={styles.h1}>The SMS Text-Back Playbook That Books More Appointments</h1>
            <p className={styles.subhead}>
              SMS is the simplest automation that produces real bookings—because it meets customers where they already are.
              The trick is timing, tone, and a clean next step.
            </p>

            <div style={{ marginTop: 14 }}>
              <Link className={styles.cardLink} href="/blog">
                ← Back to Blog
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      <div className={styles.divider} />

      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Start with missed calls (highest ROI)</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Missed call → instant text-back turns a dead end into an open loop.
              It makes you look responsive—even after hours.
            </p>
            <ul className={styles.checkList}>
              <li>Send within 15–30 seconds</li>
              <li>Keep it human</li>
              <li>Ask one question</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Templates that feel human</h3>
            <ul className={styles.checkList}>
              <li>“Hey — this is Kallr with [Business Name]. Just saw your call. What can we help with?”</li>
              <li>“Quick question: is this for today, or a different day?”</li>
              <li>“Want to book a time, or get a quick quote first?”</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>The 2-step follow-up (no spam)</h3>
            <ul className={styles.checkList}>
              <li>Later same day: “Still need help with this?”</li>
              <li>Next day: “Want me to hold a spot for you this week?”</li>
              <li>If no response: stop</li>
            </ul>

            <div className={styles.panelFoot}>
              <span className={styles.panelFootStrong}>Takeaway:</span> SMS isn’t about volume. It’s about timing + tone.
              Short, human, and action-oriented wins.
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
