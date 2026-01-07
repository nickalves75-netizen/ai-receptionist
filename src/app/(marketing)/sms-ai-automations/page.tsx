import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function SmsAiAutomationsPage() {
  return (
    <MarketingLanding
      pill="AI for Messages"
      sourcePrefix="sms"
      title={
        <>
          <span className={styles.accent}>AI for Messages</span> That Converts Missed Calls Into Booked Revenue
        </>
      }
      subhead="Instant text workflows that follow up, qualify, and schedule—so leads don’t go cold."
    />
  );
}
