import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function HomePage() {
  return (
    <MarketingLanding
      pill="AI for Calls • AI for Messages • AI for Automation"
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
