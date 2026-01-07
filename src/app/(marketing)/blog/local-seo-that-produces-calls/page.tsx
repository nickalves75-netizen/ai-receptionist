import Link from "next/link";
import styles from "@/app/(marketing)/page.module.css";
import Reveal from "@/components/marketing/motion/Reveal";

export default function BlogPost() {
  return (
    <div className={styles.page}>
      <Reveal as="section" className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroInner}>
            <div className={styles.pill}>Blog • Dec 2024 • 9 min read</div>
            <h1 className={styles.h1}>Local SEO That Produces Calls (Not Vanity Traffic)</h1>
            <p className={styles.subhead}>
              Rankings don’t pay rent—calls do. Here’s the clean local foundation we like when the goal is booked revenue.
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
            <h3 className={styles.panelTitle}>The non-negotiables</h3>
            <ul className={styles.checkList}>
              <li>Google Business Profile: complete + active</li>
              <li>Review flow: consistent requests + simple link</li>
              <li>Service pages: clear offers + service areas</li>
              <li>Mobile speed: performance matters</li>
              <li>Tracking: measure calls + booked outcomes</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>
              The multiplier: SEO + 24/7 intake
            </h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Local intent often peaks nights and weekends. If nobody answers, you’re leaking the highest-value moments.
              NEAIS helps close that gap by answering calls, handling messages, and routing next steps automatically—so the lead keeps
              moving even when your team is offline.
            </p>

            <div className={styles.panelFoot}>
              <span className={styles.panelFootStrong}>Takeaway:</span> Rank for intent, convert cleanly, respond instantly—every time.
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
