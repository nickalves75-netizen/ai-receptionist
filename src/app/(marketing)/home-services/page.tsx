import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function HomeServicesPage() {
  return (
    <MarketingLanding
      pill="Built for Home Services"
      sourcePrefix="industry-home-services"
      title={
        <>
          AI Integration for <span className={styles.accent}>Home Services</span> That Captures Leads
          & Handles the Phones
        </>
      }
      subhead="Answer every call, qualify service requests, and route bookings instantly—without adding office headcount."
      persona={{
        persona: "male",
        kicker: "24/7 answering for booked jobs",
        title: "Never Miss Another Service Call",
        body: "Kallr answers fast, collects the right job details, and routes the next step—so your team stays focused on the field while your calendar stays full.",
      }}
    />
  );
}
