import Link from "next/link";
import Image from "next/image";
import styles from "./footer.module.css";

const solutions = [
  { label: "AI For Phones", href: "/ai-phone-receptionist" },
  { label: "AI For Messages", href: "/sms-ai-automations" },
  { label: "SEO Services", href: "/seo-services" },
  { label: "Consulting", href: "/ai-consulting" },
];

const industries = [
  { label: "Home Services", href: "/home-services" },
  { label: "Automotive", href: "/automotive" },
  { label: "Health", href: "/health" },
  { label: "Education", href: "/education" },
  { label: "Contractors", href: "/contractors" },
];

const locations = [
  { label: "Boston, MA", href: "/boston-ma" },
  { label: "Providence, RI", href: "/providence-ri" },
  { label: "Hartford, CT", href: "/hartford-ct" },
];

const company = [
  { label: "Quotes", href: "/quotes" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Blog", href: "/blog" }, // footer-only
];

const legal = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* Brand / About */}
        <div className={styles.brandCol}>
          <div className={styles.brandRow}>
            <Image
              src="/main-logo.png"
              alt="NEAIS icon"
              width={250}
              height={75}
              className={styles.brandIcon}
              priority
            />
            
          </div>

          <p className={styles.blurb}>
            Intergrations + Work-Flows built to capture demand and get your business to the next step.
          </p>

          <div className={styles.meta}>© {year} NEAIS
            . All rights reserved.</div>
        </div>

        {/* Link Columns */}
        <div className={styles.cols}>
          <div className={styles.col}>
            <div className={styles.title}>Solutions</div>
            {solutions.map((i) => (
              <Link key={i.href} className={styles.link} href={i.href}>
                {i.label}
              </Link>
            ))}
          </div>

          <div className={styles.col}>
            <div className={styles.title}>Industries</div>
            {industries.map((i) => (
              <Link key={i.href} className={styles.link} href={i.href}>
                {i.label}
              </Link>
            ))}
          </div>

          <div className={styles.col}>
            <div className={styles.title}>Locations</div>
            {locations.map((i) => (
              <Link key={i.href} className={styles.link} href={i.href}>
                {i.label}
              </Link>
            ))}
          </div>

          <div className={styles.col}>
            <div className={styles.title}>Company</div>
            {company.map((i) => (
              <Link key={i.href} className={styles.link} href={i.href}>
                {i.label}
              </Link>
            ))}
          </div>

          <div className={styles.col}>
            <div className={styles.title}>Legal</div>
            {legal.map((i) => (
              <Link key={i.href} className={styles.link} href={i.href}>
                {i.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.rule} />
        <div className={styles.copy}>
          Messaging rates may apply. Reply STOP to opt out. Reply HELP for help.
        </div>
      </div>
    </footer>
  );
}
