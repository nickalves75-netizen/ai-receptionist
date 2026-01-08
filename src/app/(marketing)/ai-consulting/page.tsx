import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function AiBusinessConsultingPage() {
  return (
    <MarketingLanding
      pill="AI Busines Consulting"
      sourcePrefix="ai-consulting"
      title={
        <>
          <span className={styles.accent}>Ai Business Consulting</span> get leading reccomendations, develope a clear path.
        </>
      }
    />
  );
}