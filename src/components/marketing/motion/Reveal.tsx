"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Reveal.module.css";

type Props = {
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
  delayMs?: number;
  once?: boolean;
  threshold?: number;
  rootMargin?: string;
  style?: React.CSSProperties;
};

export default function Reveal({
  as: As = "div",
  className,
  children,
  delayMs = 0,
  once = true,
  threshold = 0.12,
  rootMargin = "0px 0px -10% 0px",
  style: styleProp,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  const delayStyle = useMemo(() => {
    return delayMs ? ({ ["--reveal-delay" as any]: `${delayMs}ms` } as React.CSSProperties) : undefined;
  }, [delayMs]);

  const mergedStyle = useMemo(() => {
    if (!delayStyle && !styleProp) return undefined;
    return { ...(delayStyle || {}), ...(styleProp || {}) } as React.CSSProperties;
  }, [delayStyle, styleProp]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduce) {
      setInView(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.unobserve(entry.target);
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold, rootMargin]);

  return (
    <As
      ref={(node: any) => {
        ref.current = node;
      }}
      className={[styles.reveal, inView ? styles.in : "", className || ""].join(" ")}
      style={mergedStyle}
    >
      {children}
    </As>
  );
}
