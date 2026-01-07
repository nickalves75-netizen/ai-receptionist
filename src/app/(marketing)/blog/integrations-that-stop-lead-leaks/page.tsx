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
            <h1 className={styles.h1}>The 5 Integrations That Stop Lead Leaks Overnight</h1>
            <p className={styles.subhead}>
              You don’t need more tools—you need your tools to talk to each other. These five connections eliminate the most common
              leaks fast and keep leads moving toward a booked next step.
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
            <h3 className={styles.panelTitle}>The 5 integrations</h3>
            <ul className={styles.checkList}>
              <li>
                <b>Calendar booking:</b> schedule the next step on first touch
              </li>
              <li>
                <b>CRM / pipeline:</b> every lead has a home, owner, and status
              </li>
              <li>
                <b>Form → SMS follow-up:</b> confirm and qualify instantly
              </li>
              <li>
                <b>Internal alerts:</b> route urgent leads to the right person
              </li>
              <li>
                <b>Outcome reporting:</b> track booked results, not pageviews
              </li>
            </ul>

            <div className={styles.panelFoot}>
              <span className={styles.panelFootStrong}>Takeaway:</span> Integrations aren’t about complexity—they’re about continuity.
              When every lead keeps moving, bookings follow.
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
