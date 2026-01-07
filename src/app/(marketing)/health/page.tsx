import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function HealthPage() {
  return (
    <MarketingLanding
      pill="Built for Health & Wellness"
      sourcePrefix="industry-health"
      title={
        <>
          AI Systems for <span className={styles.accent}>Health & Wellness</span> That Make Booking Seamless
        </>
      }
      subhead="Answer inquiries, qualify needs, and book the next step—while maintaining a calm, professional experience."
      persona={{
        persona: "male",
        kicker: "Fast scheduling + consistent intake",
        title: "Patients Get Answers Immediately",
        body: "NEAIS responds instantly, collects the right intake notes, and routes appointments or follow-ups—so you protect the patient experience and reduce missed opportunities.",
      }}
    />
  );
}
