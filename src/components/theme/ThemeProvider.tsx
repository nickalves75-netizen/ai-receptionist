"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

type ThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // 1) localStorage wins
    const saved = window.localStorage.getItem("kallr_theme") as Theme | null;
    const initial = saved ?? getSystemTheme();
    setThemeState(initial);
  }, []);

  useEffect(() => {
    // apply to <html data-theme="...">
    document.documentElement.dataset.theme = theme;
    // helps form controls/scrollbars etc
    (document.documentElement.style as any).colorScheme = theme;
    window.localStorage.setItem("kallr_theme", theme);
  }, [theme]);

  const api = useMemo<ThemeCtx>(
    () => ({
      theme,
      setTheme: (t) => setThemeState(t),
      toggle: () => setThemeState((p) => (p === "dark" ? "light" : "dark")),
    }),
    [theme]
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used within ThemeProvider");
  return v;
}
