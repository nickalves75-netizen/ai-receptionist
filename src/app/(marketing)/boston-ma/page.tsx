import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function BostonMaPage() {
  return (
    <MarketingLanding
      pill="Serving Boston, Massachusetts"
      sourcePrefix="loc-boston-ma"
      title={
        <>
          AI Receptionist in <span className={styles.accent}>Boston, MA</span> That Captures Leads &
          Books Appointments 24/7
        </>
      }
      subhead="A clean inbound system built for local demand—answering, qualifying, and routing calls the moment they come in."
      persona={{
        persona: "female",
        kicker: "Local demand, answered instantly",
        title: "Your Boston Leads Don’t Wait",
        body: "Kallr responds immediately, captures clean notes, and pushes the next step forward—so your team stays focused while your pipeline stays active.",
      }}
    />
  );
}
