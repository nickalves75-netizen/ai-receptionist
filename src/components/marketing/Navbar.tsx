"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./navbar.module.css";
import { LeadCtaButton } from "@/components/marketing/lead/LeadCtaButton";
import ThemeToggle from "@/components/theme/ThemeToggle";

type Item = { label: string; href: string };

const solutionItems: Item[] = [
  { label: "AI Phone Receptionist", href: "/ai-phone-receptionist" },
  { label: "AI SMS Automations", href: "/sms-ai-automations" },
  { label: "SEO Services", href: "/seo-services" },
];

const industryItems: Item[] = [
  { label: "Home Services", href: "/home-services" },
  { label: "Automotive", href: "/automotive" },
  { label: "Health", href: "/health" },
  { label: "Education", href: "/education" },
  { label: "Contractors", href: "/contractors" },
];

const locationItems: Item[] = [
  { label: "Boston, MA", href: "/boston-ma" },
  { label: "Providence, RI", href: "/providence-ri" },
  { label: "Hartford, CT", href: "/hartford-ct" },
];

export default function Navbar() {
  const [openSolutions, setOpenSolutions] = useState(false);
  const [openIndustries, setOpenIndustries] = useState(false);
  const [openLocations, setOpenLocations] = useState(false);

  const solRef = useRef<HTMLDivElement | null>(null);
  const indRef = useRef<HTMLDivElement | null>(null);
  const locRef = useRef<HTMLDivElement | null>(null);

  const [scrolled, setScrolled] = useState(false);

  // Hidden staff link toggle: add ?staff=1 to any public URL to reveal Staff login link.
  const [showStaff, setShowStaff] = useState(false);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (solRef.current && !solRef.current.contains(target)) setOpenSolutions(false);
      if (indRef.current && !indRef.current.contains(target)) setOpenIndustries(false);
      if (locRef.current && !locRef.current.contains(target)) setOpenLocations(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setShowStaff(params.get("staff") === "1");
    } catch {
      setShowStaff(false);
    }
  }, []);

  function closeAll() {
    setOpenSolutions(false);
    setOpenIndustries(false);
    setOpenLocations(false);
  }

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="NEAIS Home" onClick={closeAll}>
          <Image src="public\android-chrome-512x512.png" alt="NEAIS" width={120} height={34} priority className={styles.logo} />
        </Link>

        <nav className={styles.nav}>
          {/* Our Solutions */}
          <div className={styles.menuWrap} ref={solRef}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => {
                setOpenSolutions((v) => !v);
                setOpenIndustries(false);
                setOpenLocations(false);
              }}
            >
              Our Solutions <span className={styles.caret}>▾</span>
            </button>

            {openSolutions && (
              <div className={styles.dropdown} role="menu">
                {solutionItems.map((item) => (
                  <Link key={item.href} href={item.href} className={styles.dropItem} onClick={closeAll}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Industries */}
          <div className={styles.menuWrap} ref={indRef}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => {
                setOpenIndustries((v) => !v);
                setOpenSolutions(false);
                setOpenLocations(false);
              }}
            >
              Industries <span className={styles.caret}>▾</span>
            </button>

            {openIndustries && (
              <div className={styles.dropdown} role="menu">
                {industryItems.map((item) => (
                  <Link key={item.href} href={item.href} className={styles.dropItem} onClick={closeAll}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Locations dropdown */}
          <div className={styles.menuWrap} ref={locRef}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => {
                setOpenLocations((v) => !v);
                setOpenSolutions(false);
                setOpenIndustries(false);
              }}
            >
              Locations <span className={styles.caret}>▾</span>
            </button>

            {openLocations && (
              <div className={styles.dropdown} role="menu">
                {locationItems.map((item) => (
                  <Link key={item.href} href={item.href} className={styles.dropItem} onClick={closeAll}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link className={styles.link} href="/quotes" onClick={closeAll}>
            Quotes
          </Link>
          <Link className={styles.link} href="/about" onClick={closeAll}>
            About
          </Link>
          <Link className={styles.link} href="/contact" onClick={closeAll}>
            Contact
          </Link>
        </nav>

        <div className={styles.actions}>
          {/* Customer login */}
          <Link className={styles.lock} href="/portal/login" onClick={closeAll}>
  Login
</Link>


          {/* Hidden staff login: only appears if URL has ?staff=1 */}
          {showStaff && (
            <Link className={styles.link} href="/internal/login" onClick={closeAll} aria-label="Staff Login">
              Staff
            </Link>
          )}

          <LeadCtaButton className={styles.cta} source="nav-get-started">
            Get Started
          </LeadCtaButton>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}