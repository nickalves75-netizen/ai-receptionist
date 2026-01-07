import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function ProvidenceRiPage() {
  return (
    <MarketingLanding
      pill="Serving Providence, Rhode Island"
      sourcePrefix="loc-providence-ri"
      title={
        <>
          <span className={styles.accent}>AI for Calls</span> in Providence, RI that Turns Inquiries Into Booked Revenue
        </>
      }
      subhead="Answer every call, qualify quickly, and keep prospects warm with automated message follow-up."
      persona={{
        persona: "male",
        kicker: "24/7 coverage for local businesses",
        title: "A Faster Front Desk for Providence",
        body: "NEAIS captures intent, asks the right questions, and routes bookings or follow-ups automatically—so you don’t lose leads after hours.",
      }}
    />
  );
}
