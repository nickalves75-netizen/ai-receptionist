import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function HomePage() {
  return (
    <MarketingLanding
      pill="AI Reception + SMS Automations + Local SEO"
      sourcePrefix="home"
      title={
        <>
          A Clean Conversion System{" "}
          <span className={styles.accent}>That Captures Leads</span> & Books Appointments 24/7
        </>
      }
    />
  );
}
