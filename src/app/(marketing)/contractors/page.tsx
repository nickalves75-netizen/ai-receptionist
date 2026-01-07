import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function ContractorsPage() {
  return (
    <MarketingLanding
      pill="Built for Contractors"
      sourcePrefix="industry-contractors"
      title={
        <>
          <span className={styles.accent}>AI for Calls + Messages</span> for Contractors that Qualifies Leads & Books Estimates
        </>
      }
      subhead="Capture project details, pre-qualify scope, and route estimate requests automatically—so you stop chasing missed calls."
      persona={{
        persona: "male",
        kicker: "Scope captured. Estimates booked.",
        title: "A Cleaner Pipeline From Day One",
        body: "NEAIS gathers location, timeline, budget range, and project needs—then routes qualified jobs into the right next step with clean notes.",
      }}
    />
  );
}
