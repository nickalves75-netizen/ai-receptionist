import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function EducationPage() {
  return (
    <MarketingLanding
      pill="Built for Education & Training"
      sourcePrefix="industry-education"
      title={
        <>
          AI Integration for <span className={styles.accent}>Education & Training </span> That Automates Your Intake &
          Scheduling
        </>
      }
      subhead="Answer program questions, capture lead details, and route enrollments with a consistent process—24/7."
      persona={{
        persona: "female",
        kicker: "Enrollments move faster",
        title: "Consistent Follow-Up That Keeps Leads Warm",
        body: "Kallr answers common questions, collects the right details, and triggers follow-up texts so prospective students don’t slip away.",
      }}
    />
  );
}
