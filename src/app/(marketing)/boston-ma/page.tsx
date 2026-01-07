import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function BostonMaPage() {
  return (
    <MarketingLanding
      pill="Serving Boston, Massachusetts"
      sourcePrefix="loc-boston-ma"
      title={
        <>
          <span className={styles.accent}>AI for Calls</span> in Boston, MA that Answers, Qualifies, and Books 24/7
        </>
      }
      subhead="A clean inbound system built for local demand—answer calls instantly, capture the right details, and route the next step the moment a lead comes in."
      persona={{
        persona: "female",
        kicker: "Local demand, answered instantly",
        title: "Boston Leads Don’t Wait",
        body: "NEAIS responds immediately, captures clean notes, and moves the next step forward—so your team stays focused while your pipeline stays active.",
      }}
    />
  );
}
