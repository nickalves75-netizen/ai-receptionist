import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function AiPhoneReceptionistPage() {
  return (
    <MarketingLanding
      pill="AI for Calls"
      sourcePrefix="ai-phone"
      title={
        <>
          <span className={styles.accent}>AI for Calls</span> that Answers, Qualifies, and Books 24/7
        </>
      }
    />
  );
}