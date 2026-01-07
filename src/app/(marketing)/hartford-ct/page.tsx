import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function HartfordCtPage() {
  return (
    <MarketingLanding
      pill="Serving Hartford, Connecticut"
      sourcePrefix="loc-hartford-ct"
      title={
        <>
          <span className={styles.accent}>AI for Calls</span> in Hartford, CT that Answers, Qualifies, and Books
        </>
      }
      subhead="A consistent inbound system that answers instantly, captures the right details, and routes the next step—so demand turns into booked work."
      persona={{
        persona: "female",
        kicker: "Human-sounding calls + smart routing",
        title: "A Professional Experience From Hello",
        body: "NEAIS keeps conversations smooth, captures clean notes, and routes the right next step—so every caller gets a confident, polished experience.",
      }}
    />
  );
}
