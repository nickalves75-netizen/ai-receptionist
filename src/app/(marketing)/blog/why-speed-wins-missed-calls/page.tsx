import Link from "next/link";
import styles from "@/app/(marketing)/page.module.css";
import Reveal from "@/components/marketing/motion/Reveal";

export default function BlogPost() {
  return (
    <div className={styles.page}>
      <Reveal as="section" className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroInner}>
            <div className={styles.pill}>Blog • Dec 2024 • 6 min read</div>
            <h1 className={styles.h1}>Why Speed Wins: The Hidden Cost of Missed Calls</h1>
            <p className={styles.subhead}>
              If your phone rings and nobody answers, you didn’t “miss a call.” You missed a decision moment. In most industries, the
              first competent response usually wins.
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
            <h3 className={styles.panelTitle}>The real problem isn’t lead volume—it’s response time</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Most businesses try to fix revenue by buying more leads. But the hidden leak is usually what happens after the lead
              arrives. When a call goes to voicemail, you’re not competing on price anymore—you’re competing on speed.
            </p>
            <ul className={styles.checkList}>
              <li>Voicemail creates uncertainty</li>
              <li>Uncertainty makes people keep shopping</li>
              <li>The fastest responder often gets the booking</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>
              Why voicemail kills conversions (even if you call back later)
            </h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Voicemail adds friction. Customers have to explain themselves, wait, and hope you respond. Even a 15-minute callback can
              be “too late” if someone else answered live.
            </p>
            <ul className={styles.checkList}>
              <li>They were ready now — not later</li>
              <li>They don’t want to repeat details</li>
              <li>Silence reads like “too busy”</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>
              The NEAIS approach: instant response + consistent intake
            </h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              High-performing intake isn’t fancy—it’s consistent. Answer instantly, ask the same qualifying questions, capture clean
              notes, and route a next step without friction.
            </p>
            <ul className={styles.checkList}>
              <li>Answer calls 24/7</li>
              <li>Qualify leads in under 90 seconds</li>
              <li>Offer a clear next step (book / quote / route)</li>
              <li>Trigger message follow-up automatically</li>
            </ul>

            <div className={styles.panelFoot}>
              <span className={styles.panelFootStrong}>Takeaway:</span> Speed is a profit lever. Fix response time first, then scale
              lead flow.
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
