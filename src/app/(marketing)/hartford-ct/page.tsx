import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function HartfordCtPage() {
  return (
    <MarketingLanding
      pill="Serving Hartford, Connecticut"
      sourcePrefix="loc-hartford-ct"
      title={
        <>
          AI Receptionist in <span className={styles.accent}>Hartford, CT</span> That Captures Leads &
          Books Appointments
        </>
      }
      subhead="A consistent intake that answers, qualifies, and routes the next step—so demand turns into booked work."
      persona={{
        persona: "female",
        kicker: "Human-sounding calls + smart routing",
        title: "A Professional Experience From Hello",
        body: "Kallr keeps conversations smooth, captures clean notes, and routes the right next step—so every caller gets a confident, polished experience.",
      }}
    />
  );
}
