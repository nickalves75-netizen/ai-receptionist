import styles from "@/app/(marketing)/page.module.css";
import Reveal from "@/components/marketing/motion/Reveal";
import { LeadCtaButton } from "@/components/marketing/lead/LeadCtaButton";

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <Reveal as="section" className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroInner}>
            <div className={styles.pill}>Contact</div>

            <h1 className={styles.h1}>
              Tell us what you’re running today—<span className={styles.accent}>we’ll map the fix.</span>
            </h1>

            <p className={styles.subhead}>
              The fastest way to start is the Kallr assessment. We’ll review your intake and propose a clean,
              conversion-focused setup.
            </p>

            <div className={styles.heroCtas}>
              <LeadCtaButton className={`${styles.btn} ${styles.btnPrimary}`} source="contact-hero">
                Start Assessment
              </LeadCtaButton>

              <a className={`${styles.btn} ${styles.btnOutline}`} href="/case-studies">
                View Case Studies
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
