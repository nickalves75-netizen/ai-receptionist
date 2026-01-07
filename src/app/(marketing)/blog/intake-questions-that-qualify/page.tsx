import Link from "next/link";
import styles from "@/app/(marketing)/page.module.css";
import Reveal from "@/components/marketing/motion/Reveal";

export default function BlogPost() {
  return (
    <div className={styles.page}>
      <Reveal as="section" className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroInner}>
            <div className={styles.pill}>Blog • Dec 2024 • 8 min read</div>
            <h1 className={styles.h1}>7 Intake Questions That Qualify Leads (Without Feeling Pushy)</h1>
            <p className={styles.subhead}>
              Strong intake feels natural to the customer—and creates a clean next step behind the scenes. Here’s the framework we
              use at NEAIS to keep bookings consistent.
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
            <h3 className={styles.panelTitle}>The goal of intake isn’t information—it’s direction</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Intake should produce a clear next step: book, route, quote, or disqualify politely. These questions reduce
              back-and-forth and move the lead forward fast—whether it starts on a call, a text, or a website form.
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>
              The 7 questions (plug-and-play)
            </h3>
            <ul className={styles.checkList}>
              <li>1) “What can we help you with today?”</li>
              <li>2) “Where is the service needed? (city/zip)”</li>
              <li>3) “When are you looking to get this done?”</li>
              <li>4) “Is this residential or commercial?”</li>
              <li>5) “What’s the size or scope?” (simple options work best)</li>
              <li>6) “Any photos or details you can share?” (optional)</li>
              <li>7) “Best way to follow up—call or text?”</li>
            </ul>

            <div className={styles.panelFoot}>
              <span className={styles.panelFootStrong}>Takeaway:</span> The best intake feels easy to the customer and powerful for
              the business. Consistency creates conversion.
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}





