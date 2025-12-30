import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function ContractorsPage() {
  return (
    <MarketingLanding
      pill="Built for Contractors"
      sourcePrefix="industry-contractors"
      title={
        <>
          AI Receptionist for <span className={styles.accent}>Contractors</span> That Qualifies Leads
          & Books Estimates
        </>
      }
      subhead="Capture project details, pre-qualify scope, and route estimate requests automatically—so you stop chasing missed calls."
      persona={{
        persona: "male",
        kicker: "Scope captured. Estimates booked.",
        title: "A Cleaner Pipeline From Day One",
        body: "Kallr gathers location, timeline, budget range, and project needs—then routes qualified jobs into the right next step with clean notes.",
      }}
    />
  );
}
