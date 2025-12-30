import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function AiPhoneReceptionistPage() {
  return (
    <MarketingLanding
      pill="AI Phone Receptionist + Local SEO"
      sourcePrefix="ai-phone"
      title={
        <>
          <span className={styles.accent}>AI Phone Receptionist</span> That Captures Leads & Books
          Appointments 24/7
        </>
      }
    />
  );
}
