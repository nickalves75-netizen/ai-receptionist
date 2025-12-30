import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function ProvidenceRiPage() {
  return (
    <MarketingLanding
      pill="Serving Providence, Rhode Island"
      sourcePrefix="loc-providence-ri"
      title={
        <>
          AI Receptionist in <span className={styles.accent}>Providence, RI</span> That Converts Calls
          Into Booked Revenue
        </>
      }
      subhead="Answer every call, qualify quickly, and keep prospects warm with automated follow-ups."
      persona={{
        persona: "male",
        kicker: "24/7 coverage for local businesses",
        title: "A Faster Front Desk for Providence",
        body: "Kallr captures intent, asks the right questions, and routes bookings or follow-ups automatically—so you don’t lose leads after hours.",
      }}
    />
  );
}
