import Link from "next/link";
import styles from "@/app/(marketing)/page.module.css";
import Reveal from "@/components/marketing/motion/Reveal";

const posts = [
  {
    href: "/blog/why-speed-wins-missed-calls",
    title: "Why Speed Wins: The Hidden Cost of Missed Calls",
    excerpt:
      "Most businesses don’t lose leads because they’re bad—they lose leads because they respond too late. Here’s the math, the psychology, and the fix.",
    date: "Dec 2024",
    readTime: "6 min read",
  },
  {
    href: "/blog/sms-text-back-playbook",
    title: "The SMS Text-Back Playbook That Books More Appointments",
    excerpt:
      "A simple, human-sounding text flow that turns missed calls and web leads into booked next steps—without annoying your customers.",
    date: "Dec 2024",
    readTime: "7 min read",
  },
  {
    href: "/blog/intake-questions-that-qualify",
    title: "7 Intake Questions That Instantly Qualify Leads (Without Feeling Pushy)",
    excerpt:
      "Steal our framework: ask better questions, route faster, and stop wasting time on leads that were never a fit.",
    date: "Dec 2024",
    readTime: "8 min read",
  },
  {
    href: "/blog/local-seo-that-produces-calls",
    title: "Local SEO That Produces Calls (Not Vanity Traffic)",
    excerpt:
      "Ranking is cool—but booked revenue is the goal. Here’s the exact local SEO foundation we like for service businesses.",
    date: "Dec 2024",
    readTime: "9 min read",
  },
  {
    href: "/blog/integrations-that-stop-lead-leaks",
    title: "The 5 Integrations That Stop Lead Leaks Overnight",
    excerpt:
      "Your stack doesn’t need to be complicated. These 5 connections eliminate manual work and keep every lead moving.",
    date: "Dec 2024",
    readTime: "7 min read",
  },
];

export default function BlogIndexPage() {
  return (
    <div className={styles.page}>
      {/* HERO BG WRAPPER (style goes here, not on Reveal) */}
      <section
        className={styles.hero}
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(43, 43, 43, 0.9), rgba(255,255,255,0.92)), url('/brand/neais-logo-800w.png')",
          backgroundSize: "cover",
          backgroundPosition: "82% 18%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Reveal as="div">
          <div className={styles.container}>
            <div className={styles.heroInner}>
              <div className={styles.pill}>Blog</div>

              <h1 className={styles.h1}>NEAIS Field Notes</h1>

              <p className={styles.subhead}>
                Practical notes built from real conversations with growing businesses. We share what’s working to capture leads
                faster, follow up cleaner, and book more revenue—without adding headcount.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <div className={styles.divider} />

      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <div className={styles.grid4} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" as any }}>
            {posts.map((p, idx) => (
              <Reveal key={p.href} as="div" delayMs={80 + idx * 60} className={styles.card}>
                <div className={styles.sectionSub} style={{ textAlign: "left" }}>
                  {p.date} • {p.readTime}
                </div>

                <h3 className={styles.cardTitle} style={{ marginTop: 8 }}>
                  {p.title}
                </h3>

                <p className={styles.cardText}>{p.excerpt}</p>

                <Link className={styles.cardLink} href={p.href}>
                  Read the full post →
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
