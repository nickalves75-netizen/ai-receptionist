import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function AutomotivePage() {
  return (
    <MarketingLanding
      pill="Built for Automotive"
      sourcePrefix="industry-automotive"
      title={
        <>
          AI Integration for <span className={styles.accent}>Automotive</span> That Converts Leads
          Into Solid Appointments
        </>
      }
      subhead="Handle quotes, availability, and intake questions instantly—then book or route the right next step."
      persona={{
        persona: "female",
        kicker: "Human-sounding intake + fast routing",
        title: "A Better Front Desk Without the Wait",
        body: "Kallr captures vehicle details, service needs, and urgency—then routes calls and texts follow-ups automatically so your team can stay on the floor.",
      }}
    />
  );
}
