import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function SeoServicesPage() {
  return (
    <MarketingLanding
      pill="AI for Marketing (Local SEO)"
      sourcePrefix="seo"
      title={
        <>
          <span className={styles.accent}>AI for Marketing</span> That Turns Search Intent Into Calls
        </>
      }
      subhead="Clean local SEO plus conversion-focused pages designed to generate calls—not vanity traffic."
    />
  );
}
