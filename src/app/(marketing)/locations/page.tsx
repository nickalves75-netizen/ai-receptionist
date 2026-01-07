import styles from "../page.module.css";

import { LeadCtaButton } from "@/components/marketing/lead/LeadCtaButton";
import Reveal from "@/components/marketing/motion/Reveal";

export default function LocationsPage() {
  return (
    <div className={styles.page}>
      <Reveal as="section" className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroInner}>
            <div className={styles.pill}>Built for local markets</div>

            <h1 className={styles.h1}>
              <span className={styles.accent}>Locations</span> We Support
            </h1>

            <p className={styles.subhead}>
              NEAIS can deploy nationwide—this page is built for local relevance and market-specific search.
            </p>

            <div className={styles.heroCtas}>
              <LeadCtaButton className={`${styles.btn} ${styles.btnPrimary}`} source="locations-hero">
                Request Availability
              </LeadCtaButton>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
