"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./internal.module.css";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

type ApiItem = {
  id: string;
  display: string;
  email?: string;
  phone?: string;
  stage?: string;
};

type SearchHit = {
  id: string;
  title: string;
  sub: string;
  stage?: string;
};

function active(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function InternalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // ✅ Hooks must ALWAYS run (no early returns before hooks)
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [q, setQ] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const reqId = useRef(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const isLogin = pathname === "/internal/login";

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/internal/login";
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (isLogin) return;

    function onDown(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [isLogin]);

  // Live search (debounced)
  useEffect(() => {
    if (isLogin) return;

    const next = q.trim();
    if (!next) {
      setHits([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setOpen(true);

    const my = ++reqId.current;
    const t = window.setTimeout(async () => {
      try {
        // ✅ Correct route for: src/app/internal/search/route.ts
        const res = await fetch(`/internal/search?q=${encodeURIComponent(next)}`, { cache: "no-store" });
        const json = (await res.json()) as { ok?: boolean; items?: ApiItem[] };

        if (reqId.current !== my) return;

        const items = Array.isArray(json?.items) ? json.items : [];

        const mapped: SearchHit[] = items.map((it) => ({
          id: String(it.id),
          title: String(it.display || `Lead ${String(it.id).slice(0, 6)}`),
          sub: (it.email && String(it.email)) || (it.phone && String(it.phone)) || (it.stage ? `Stage: ${it.stage}` : "—"),
          stage: it.stage,
        }));

        setHits(mapped);
      } catch {
        if (reqId.current !== my) return;
        setHits([]);
      } finally {
        if (reqId.current === my) setLoading(false);
      }
    }, 160);

    return () => window.clearTimeout(t);
  }, [q, isLogin]);

  function goLead(id: string) {
    setOpen(false);
    router.push(`/internal/leads/${encodeURIComponent(id)}`);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hits.length === 1) return goLead(hits[0].id);
    setOpen(true);
  }

  // ✅ Conditional render AFTER hooks
  if (isLogin) return <>{children}</>;

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <div className={s.brandRow}>
          <div className={s.brandIcon}>
            <Image src="/neais-logo.png" alt="NEAIS" width={40} height={40} />
          </div>
          <div className={s.brandText}>
            <div className={s.brandTitle}>Internal</div>
            <div className={s.brandTitle} style={{ marginTop: 2 }}>
              Dashboard
            </div>
          </div>
        </div>

        <nav className={s.nav}>
          <Link className={`${s.navItem} ${active(pathname, "/internal/overview") ? s.navItemActive : ""}`} href="/internal/overview">
            Overview
          </Link>

          <Link className={`${s.navItem} ${active(pathname, "/internal/pipeline") ? s.navItemActive : ""}`} href="/internal/pipeline">
            Pipeline
          </Link>

          <Link className={`${s.navItem} ${active(pathname, "/internal/sales-studio") ? s.navItemActive : ""}`} href="/internal/sales-studio">
            Sales Studio
          </Link>
        </nav>

        <div className={s.sidebarFoot}>
          <button className={s.btnGhost} onClick={signOut}>
            Logout
          </button>
        </div>
      </aside>

      <div className={s.main}>
        <header className={s.topbar}>
          <div className={s.searchCenter} ref={boxRef}>
            <form className={s.searchForm} onSubmit={onSearchSubmit}>
              <input
                className={s.searchInput}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name / email / phone / company / id…"
                onFocus={() => q.trim() && setOpen(true)}
              />
              <button className={s.btnPrimarySm} type="submit">
                Search
              </button>
            </form>

            {open && (
              <div className={s.searchDrop}>
                {loading ? (
                  <div className={s.searchStatus}>Searching…</div>
                ) : hits.length ? (
                  hits.slice(0, 8).map((h) => (
                    <button key={h.id} className={s.searchHit} onClick={() => goLead(h.id)} type="button">
                      <div className={s.searchHitTop}>
                        <div className={s.searchHitTitle}>{h.title}</div>
                        <div className={s.searchHitId}>{h.id.slice(0, 8)}…</div>
                      </div>
                      <div className={s.searchHitSub}>{h.sub || "—"}</div>
                    </button>
                  ))
                ) : (
                  <div className={s.searchStatus}>No matches</div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className={s.content}>{children}</div>
      </div>
    </div>
  );
}
