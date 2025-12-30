import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function SmsAiAutomationsPage() {
  return (
    <MarketingLanding
      pill="Text-back + nurture + reminders"
      sourcePrefix="sms"
      title={
        <>
          <span className={styles.accent}>AI SMS Automations</span> That Convert Missed Calls Into
          Booked Revenue
        </>
      }
      subhead="Instant text workflows that follow up, qualify, and schedule—so leads don’t go cold."
    />
  );
}
