"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/app/(marketing)/page.module.css";

type Step = { title: string; body: string };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function RoadmapTimeline(props: {
  kicker?: string;
  title?: string;
  subtitle?: string;
  steps?: Step[];
}) {
  const wrapRef = useRef<HTMLElement | null>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const steps = useMemo<Step[]>(
    () =>
      props.steps ?? [
        {
          title: "Consultation",
          body: "We learn your current intake, your best customers, and what “a good lead” actually means for your team.",
        },
        {
          title: "Business Mapping",
          body: "We design the exact questions, routing rules, and booking logic that matches how you sell and deliver.",
        },
        {
          title: "Build + Launch",
          body: "We implement phone + SMS workflows, connect the essentials, and go live with a clean conversion path.",
        },
        {
          title: "Run + Optimize",
          body: "We monitor performance, tune the flow, and improve results over time—without adding headcount.",
        },
      ],
    [props.steps]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    let raf = 0;

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 800;

        // Progress from when top hits ~35% of viewport until the section ends
        const start = vh * 0.35;
        const total = rect.height - vh * 0.35;
        const p = clamp((start - rect.top) / Math.max(total, 1), 0, 1);
        setProgress(p);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    // Step "pop" based on visibility
    const nodes = stepRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!nodes.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop);

        if (visible.length) {
          const idx = nodes.indexOf(visible[0].target as HTMLDivElement);
          if (idx >= 0) setActiveIndex(idx);
        }
      },
      { root: null, threshold: 0.45 }
    );

    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  const kicker = props.kicker ?? "Roadmap";
  const title = props.title ?? "How NEAIS deploys";
  const subtitle =
    props.subtitle ??
    "A simple path from first call to a live system—then ongoing optimization as you grow.";

  // SVG path settings (vertical dotted line)
  const strokeDash = 10; // dot pattern
  const pathLen = 1000; // virtual length for dash animation
  const dashOffset = (1 - progress) * pathLen;

  return (
    <section ref={wrapRef as any} className={`${styles.section} ${styles.roadmapSection}`}>
      <div className={styles.container}>
        <div className={styles.roadmapHead}>
          <div className={styles.roadmapKicker}>{kicker}</div>
          <h2 className={styles.h2}>{title}</h2>
          <p className={styles.sectionSub}>{subtitle}</p>
        </div>

        <div className={styles.roadmapGrid}>
          {/* Left: dotted path */}
          <div className={styles.roadmapRail} aria-hidden="true">
            <svg className={styles.roadmapSvg} viewBox="0 0 40 1000" preserveAspectRatio="none">
              {/* background dotted path */}
              <path
                d="M20 20 L20 980"
                fill="none"
                stroke="rgba(15,23,42,0.18)"
                strokeWidth="3"
                strokeDasharray={`${strokeDash} ${strokeDash}`}
                strokeLinecap="round"
              />
              {/* animated foreground path */}
              <path
                d="M20 20 L20 980"
                fill="none"
                stroke="rgba(245, 21, 21, 0.85)"
                strokeWidth="3"
                strokeDasharray={`${strokeDash} ${strokeDash}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 120ms linear" }}
              />
            </svg>

            {/* step dots */}
            {steps.map((_, i) => (
              <div
                key={i}
                className={`${styles.roadmapDot} ${i <= activeIndex ? styles.roadmapDotActive : ""}`}
                style={{ top: `${(i / (steps.length - 1)) * 100}%` }}
              />
            ))}
          </div>

          {/* Right: step cards */}
          <div className={styles.roadmapSteps}>
            {steps.map((s, i) => (
              <div
                key={s.title}
                ref={(node) => {
                  stepRefs.current[i] = node;
                }}
                className={`${styles.roadmapStep} ${i === activeIndex ? styles.roadmapStepActive : ""}`}
              >
                <div className={styles.roadmapStepNum}>{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <div className={styles.roadmapStepTitle}>{s.title}</div>
                  <div className={styles.roadmapStepBody}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
