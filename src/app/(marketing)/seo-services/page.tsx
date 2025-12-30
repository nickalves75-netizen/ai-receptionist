import MarketingLanding from "@/components/marketing/MarketingLanding";
import styles from "@/app/(marketing)/page.module.css";

export default function SeoServicesPage() {
  return (
    <MarketingLanding
      pill="Local SEO foundations + intent pages"
      sourcePrefix="seo"
      title={
        <>
          <span className={styles.accent}>SEO Services</span> That Turn Search Intent Into Calls &
          Appointments
        </>
      }
      subhead="Clean local SEO plus conversion-focused pages designed to generate calls—not vanity traffic."
    />
  );
}
