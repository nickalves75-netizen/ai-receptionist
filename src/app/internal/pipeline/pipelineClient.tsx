"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./pipeline.module.css";

type PipelineStage = { key: string; label: string };

type PendingMove = {
  leadId: string;
  leadLabel: string;
  fromStage: string;
  toStage: string;
  toLabel: string;
};

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function fmtMoney(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function StarIcon({ filled }: { filled: boolean }) {
  // clean inline SVG, no dependency
  return (
    <svg
      className={styles.favIcon}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 17.6l-5.4 3.2 1.4-6.1L3 9.9l6.3-.6L12 3.6l2.7 5.7 6.3.6-5 4.8 1.4 6.1z"
        fill={filled ? "rgba(247,231,182,0.95)" : "transparent"}
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PipelineClient({
  pipeline,
  grouped,
  moveLeadStage,
}: {
  pipeline: PipelineStage[];
  grouped: Record<string, any[]>;
  moveLeadStage: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();

  const stageLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    pipeline.forEach((p) => m.set(p.key, p.label));
    return m;
  }, [pipeline]);

  const [byStage, setByStage] = useState<Record<string, any[]>>(grouped);
  useEffect(() => setByStage(grouped), [grouped]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingMove | null>(null);
  const [saving, setSaving] = useState(false);
  const [moveErr, setMoveErr] = useState<string>("");

  // ---------------------------
  // Favorites (localStorage persisted)
  // ---------------------------
  const [fav, setFav] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("kallr_pipeline_favs");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") setFav(parsed);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("kallr_pipeline_favs", JSON.stringify(fav));
    } catch {
      // ignore
    }
  }, [fav]);

  const isFav = (id: string) => !!fav[String(id)];

  function toggleFav(id: string) {
    const key = String(id);
    setFav((m) => ({ ...m, [key]: !m[key] }));
  }

  function sortByFav<T extends { id: any }>(arr: T[]) {
    // stable sort: favorites first, otherwise keep original order
    const tagged = arr.map((x, idx) => ({ x, idx, f: isFav(String(x.id)) ? 1 : 0 }));
    tagged.sort((a, b) => (b.f - a.f) || (a.idx - b.idx));
    return tagged.map((t) => t.x);
  }

  // ---------------------------
  // Horizontal auto-scroll while dragging (edge scroll)
  // ---------------------------
  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrollDirRef = useRef<number>(0); // -1 left, +1 right, 0 none

  const stopAutoScroll = () => {
    scrollDirRef.current = 0;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const tickAutoScroll = () => {
    const el = boardWrapRef.current;
    if (!el) {
      stopAutoScroll();
      return;
    }

    const dir = scrollDirRef.current;
    if (!dir) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const speed = 14; // px per frame
    el.scrollLeft += dir * speed;

    rafRef.current = requestAnimationFrame(tickAutoScroll);
  };

  const setAutoScrollDir = (dir: number) => {
    if (scrollDirRef.current === dir) return;
    scrollDirRef.current = dir;

    if (dir !== 0 && rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tickAutoScroll);
    }
    if (dir === 0) stopAutoScroll();
  };

  useEffect(() => {
    return () => stopAutoScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ---------------------------

  const go = (id: string) => router.push(`/internal/leads/${encodeURIComponent(id)}`);

  function findLead(leadId: string) {
    for (const p of pipeline) {
      const arr = byStage[p.key] ?? [];
      const idx = arr.findIndex((x: any) => String(x.id) === String(leadId));
      if (idx >= 0) return { stage: p.key, idx, lead: arr[idx] };
    }
    return null;
  }

  function optimisticMove(leadId: string, fromStage: string, toStage: string) {
    setByStage((prev) => {
      const next: Record<string, any[]> = {};
      for (const p of pipeline) next[p.key] = Array.isArray(prev[p.key]) ? [...prev[p.key]] : [];

      const fromArr = next[fromStage] ?? [];
      const i = fromArr.findIndex((x: any) => String(x.id) === String(leadId));
      if (i < 0) return prev;

      const [lead] = fromArr.splice(i, 1);
      lead._stage = toStage;

      next[fromStage] = fromArr;
      next[toStage] = [lead, ...(next[toStage] ?? [])];
      return next;
    });
  }

  async function confirmMove() {
    if (!pending) return;
    setSaving(true);
    setMoveErr("");

    optimisticMove(pending.leadId, pending.fromStage, pending.toStage);

    try {
      const fd = new FormData();
      fd.set("lead_id", pending.leadId);
      fd.set("stage", pending.toStage);
      await moveLeadStage(fd);

      setPending(null);
      setDraggingId(null);
      setDragOverStage(null);
      stopAutoScroll();

      router.refresh();
    } catch (e: any) {
      router.refresh();
      setMoveErr(safeStr(e?.message) || "Could not move lead. Please try again.");
      setPending(null);
      setDraggingId(null);
      setDragOverStage(null);
      stopAutoScroll();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.h1}>Pipeline</h1>
      </div>

      <div
        className={styles.boardWrap}
        ref={boardWrapRef}
        onDragOver={(e) => {
          e.preventDefault();
          if (!draggingId) return;

          const el = boardWrapRef.current;
          if (!el) return;

          const r = el.getBoundingClientRect();
          const x = e.clientX - r.left;
          const edge = 70;

          if (x < edge) setAutoScrollDir(-1);
          else if (x > r.width - edge) setAutoScrollDir(1);
          else setAutoScrollDir(0);
        }}
        onDragLeave={() => setAutoScrollDir(0)}
        onDrop={() => setAutoScrollDir(0)}
      >
        <div className={styles.board}>
          {pipeline.map((p) => {
            const raw = byStage[p.key] ?? [];
            const arr = sortByFav(raw);

            const isOver = dragOverStage === p.key;

            return (
              <section key={p.key} className={`${styles.col} ${isOver ? styles.colDragOver : ""}`}>
                <div className={styles.colHead}>
                  <div className={styles.colTitle}>{p.label}</div>
                  <div className={styles.colCount} aria-label={`${arr.length} leads`}>
                    {arr.length}
                  </div>
                </div>

                <div
                  className={styles.colScroll}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverStage(p.key);
                  }}
                  onDragLeave={() => setDragOverStage((cur) => (cur === p.key ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const leadId = e.dataTransfer.getData("text/lead-id");
                    if (!leadId) return;

                    const found = findLead(leadId);
                    if (!found) return;

                    const fromStage = found.stage;
                    const toStage = p.key;

                    setDragOverStage(null);
                    if (fromStage === toStage) return;

                    const leadLabel = safeStr(found.lead?._company || found.lead?._display || "LEAD").trim();

                    setPending({
                      leadId,
                      leadLabel,
                      fromStage,
                      toStage,
                      toLabel: stageLabelByKey.get(toStage) ?? toStage,
                    });
                  }}
                >
                  {arr.length ? (
                    arr.map((l: any) => {
                      const id = String(l.id);
                      const open = !!expanded[id];
                      const favored = isFav(id);

                      return (
                        <article
                          key={id}
                          className={`${styles.card} ${draggingId === id ? styles.cardDragging : ""}`}
                          draggable
                          onDragStart={(e) => {
                            setDraggingId(id);
                            e.dataTransfer.setData("text/lead-id", id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverStage(null);
                            stopAutoScroll();
                          }}
                        >
                          {/* Header / green bar */}
                          <button type="button" className={styles.cardHeader} onClick={() => go(id)} title="Open lead">
                            <div className={styles.cardHeaderInner}>
                              <div className={styles.cardCompany}>{l._company}</div>

                              {/* Favorite button */}
                              <button
                                type="button"
                                className={styles.favBtn}
                                onClick={(e) => {
                                  e.stopPropagation(); // don't open lead
                                  toggleFav(id);
                                }}
                                aria-label={favored ? "Unfavorite lead" : "Favorite lead"}
                                title={favored ? "Unfavorite" : "Favorite"}
                              >
                                <StarIcon filled={favored} />
                              </button>
                            </div>
                          </button>

                          {/* Collapsed view */}
                          <div className={styles.cardBody}>
                            <div className={styles.row}>
                              <div className={styles.rowLabel}>Contact</div>
                              <div className={styles.rowValue}>{l._display || "—"}</div>
                            </div>

                            <div className={styles.sep} />

                            <div className={styles.row}>
                              <div className={styles.rowLabel}>Phone</div>
                              <div className={styles.rowValue}>{l.phone || "—"}</div>
                            </div>
                          </div>

                          {/* Expandable */}
                          <div className={`${styles.expandWrap} ${open ? styles.expandOpen : ""}`}>
                            <div className={styles.expandInner}>
                              <div className={styles.sep} />

                              <div className={styles.row}>
                                <div className={styles.rowLabel}>Qualified</div>
                                <div className={styles.rowValue}>{l._qualified_service || "—"}</div>
                              </div>

                              <div className={styles.sep} />

                              <div className={styles.row}>
                                <div className={styles.rowLabel}>Next Step</div>
                                <div className={styles.rowValue}>{l.next_step || "—"}</div>
                              </div>

                              <div className={styles.sep} />

                              <div className={styles.row}>
                                <div className={styles.rowLabel}>Setup</div>
                                <div className={styles.rowValue}>{fmtMoney(l.deal_value)}</div>
                              </div>

                              <div className={styles.sep} />

                              <div className={styles.row}>
                                <div className={styles.rowLabel}>MRR</div>
                                <div className={styles.rowValue}>{fmtMoney(l.mrr)}</div>
                              </div>

                              <div className={styles.sep} />

                              <div className={styles.row}>
                                <div className={styles.rowLabel}>Industry</div>
                                <div className={styles.rowValue}>{l._industry || "—"}</div>
                              </div>

                              <div className={styles.sep} />

                              <div className={styles.row}>
                                <div className={styles.rowLabel}>Address</div>
                                <div className={styles.rowValue}>{l._address || "—"}</div>
                              </div>

                              <div className={styles.sep} />

                              <div className={styles.row}>
                                <div className={styles.rowLabel}>Email</div>
                                <div className={styles.rowValue}>{l.email || "—"}</div>
                              </div>
                            </div>
                          </div>

                          {/* View more pinned bottom */}
                          <button
                            type="button"
                            className={`${styles.viewMore} ${open ? styles.viewMoreUp : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded((m) => ({ ...m, [id]: !m[id] }));
                            }}
                            title={open ? "View less" : "View more"}
                          >
                            <span className={styles.viewMoreText}>{open ? "View less" : "View more"}</span>
                            <span className={styles.chev}>⌄</span>
                          </button>
                        </article>
                      );
                    })
                  ) : (
                    <div className={styles.emptyCol}>No leads</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Confirm modal */}
      {pending ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalTitle}>Confirm Move</div>
            <div className={styles.modalBody}>
              Are you sure you’d like to move{" "}
              <span className={styles.modalStrong}>{pending.leadLabel}</span> to{" "}
              <span className={styles.modalStrong}>{pending.toLabel}</span>?
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setPending(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={confirmMove} disabled={saving}>
                {saving ? "Moving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {moveErr ? <div className={styles.toastErr}>{moveErr}</div> : null}
    </div>
  );
}