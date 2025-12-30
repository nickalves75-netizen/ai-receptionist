"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  display: string;
  email?: string;
  phone?: string;
  stage?: string;
};

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function InternalSearch() {
  const router = useRouter();

  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [active, setActive] = React.useState<number>(-1);

  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const debounceRef = React.useRef<number | null>(null);

  const runSearch = React.useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setItems([]);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);

    try {
      const res = await fetch(`/internal/search?q=${encodeURIComponent(trimmed)}`, {
        method: "GET",
        cache: "no-store",
        signal: ac.signal,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setItems([]);
        setLoading(false);
        return;
      }

      const next: Item[] = Array.isArray(json?.items) ? json.items : [];
      setItems(next);
      setActive(next.length ? 0 : -1);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce typing
  React.useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    setOpen(true);
    debounceRef.current = window.setTimeout(() => {
      runSearch(q);
    }, 140);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, runSearch]);

  // Close on outside click
  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(t)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(item: Item) {
    setOpen(false);
    setQ("");
    setItems([]);
    setActive(-1);
    router.push(`/internal/leads/${item.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      if (active >= 0 && items[active]) {
        e.preventDefault();
        go(items[active]);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
  }

  const showDropdown = open && (q.trim().length > 0) && (loading || items.length > 0);

  return (
    <div ref={wrapRef} className="relative w-full max-w-[760px]">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search name / email / phone / company / lead id…"
            className={clsx(
              "w-full rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm",
              "outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
            )}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="internal-search-listbox"
            aria-autocomplete="list"
          />
          {loading ? (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/45">
              Searching…
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => runSearch(q)}
          className={clsx(
            "rounded-full px-4 py-2.5 text-sm font-semibold",
            "bg-emerald-700 text-white hover:bg-emerald-800"
          )}
        >
          Search
        </button>
      </div>

      {showDropdown ? (
        <div
          id="internal-search-listbox"
          role="listbox"
          className={clsx(
            "absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl"
          )}
        >
          <div className="max-h-[360px] overflow-auto p-1">
            {items.length === 0 && !loading ? (
              <div className="px-3 py-3 text-sm text-black/55">No matches.</div>
            ) : null}

            {items.map((it, idx) => {
              const isActive = idx === active;
              return (
                <button
                  key={it.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(it)}
                  className={clsx(
                    "w-full rounded-xl px-3 py-2 text-left",
                    isActive ? "bg-emerald-50" : "hover:bg-black/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-black">
                        {it.display}
                      </div>
                      <div className="truncate text-xs text-black/55">
                        {it.email ? it.email : it.phone ? it.phone : `Lead ${it.id.slice(0, 8)}…`}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-black/70">
                      {(it.stage || "new").toUpperCase()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}