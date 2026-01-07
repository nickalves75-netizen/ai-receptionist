import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function AutomotivePage() {
  return (
    <MarketingLanding
      pill="Built for Automotive"
      sourcePrefix="industry-automotive"
      title={
        <>
          AI Systems for <span className={styles.accent}>Automotive</span> That Turn Leads Into Booked Work
        </>
      }
      subhead="Answer calls and texts instantly, capture vehicle details, and route the next step—quote, schedule, or callback—without slowing the shop down."
      persona={{
        persona: "female",
        kicker: "Fast intake + smart routing",
        title: "A Better Front Desk for Busy Shops",
        body:
          "NEAIS handles first-contact for calls and messages, gathers the essentials (vehicle, service, timing), and pushes clean notes to your team—so techs stay productive and customers feel taken care of.",
      }}
    />
  );
}
