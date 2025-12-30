"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Metrics = {
  business_id?: string;
  days: number;
  total_calls: number;
  answered_calls: number;
  leads_captured: number;
  transfers: number;
  bookings: number;
  avg_duration_seconds: number;
};

type RecentRow = {
  id: string;
  started_at: string | null;
  status: string | null;
  from_number: string | null;
  to_number: string | null;
  duration_seconds: number | null;
  outcome: string;
  call_reason: string | null;
  notes: string | null;
  lead_captured: boolean;
  transferred: boolean;
  booked: boolean;
};

function fmtSec(s: number) {
  const ss = Math.max(0, Math.floor(s));
  const m = Math.floor(ss / 60);
  const r = ss % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

function badge(outcome: string) {
  if (outcome === "booked") return "Booked";
  if (outcome === "transferred") return "Transferred";
  if (outcome === "lead_captured") return "Lead";
  if (outcome === "info_only") return "Info";
  return "Other";
}

export default function PortalPage() {
  const router = useRouter();
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [rows, setRows] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const myReqId = ++reqIdRef.current;

    setLoading(true);
    setErr("");

    const mRes = await fetch(`/api/portal/metrics?days=${days}`, { cache: "no-store" });

    // If session expired / not logged in, route handlers commonly return 401/403
    if (mRes.status === 401 || mRes.status === 403) {
      router.replace("/portal/login");
      return;
    }

    if (!mRes.ok) {
      setLoading(false);
      setErr("Could not load metrics. Please refresh or log in again.");
      return;
    }

    const m = (await mRes.json()) as Metrics;

    const rRes = await fetch(`/api/portal/recent-calls`, { cache: "no-store" });
    if (rRes.status === 401 || rRes.status === 403) {
      router.replace("/portal/login");
      return;
    }
    if (!rRes.ok) {
      setLoading(false);
      setErr("Could not load recent calls.");
      return;
    }

    const rJson = await rRes.json();

    // Prevent stale responses from overwriting newer ones (fast switching days)
    if (reqIdRef.current !== myReqId) return;

    setMetrics(m);
    setRows(Array.isArray(rJson?.rows) ? rJson.rows : []);
    setLoading(false);
  }, [days, router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Dashboard</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Call performance and lead activity for your business.</p>

          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <Link href="/portal/activity" style={linkPill()}>Activity</Link>
            <Link href="/portal/leads" style={linkPill()}>Leads</Link>
            <Link href="/portal/support" style={linkPill()}>Support</Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setDays(1)} style={btn(days === 1)}>Today</button>
          <button onClick={() => setDays(7)} style={btn(days === 7)}>7 days</button>
          <button onClick={() => setDays(30)} style={btn(days === 30)}>30 days</button>
        </div>
      </div>

      {err ? (
        <div style={panel()}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Error</div>
          <div style={{ opacity: 0.8 }}>{err}</div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12, marginTop: 18 }}>
        <Card label="Total Calls" value={metrics?.total_calls} loading={loading} />
        <Card label="Answered" value={metrics?.answered_calls} loading={loading} />
        <Card label="Leads" value={metrics?.leads_captured} loading={loading} />
        <Card label="Transfers" value={metrics?.transfers} loading={loading} />
        <Card label="Bookings" value={metrics?.bookings} loading={loading} />
        <Card label="Avg Duration" value={metrics ? fmtSec(metrics.avg_duration_seconds) : undefined} loading={loading} />
      </div>

      <div style={{ marginTop: 12, ...panel(), padding: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.72 }}>Quick insight</div>
        <div style={{ marginTop: 8, fontWeight: 800 }}>
          {loading || !metrics
            ? "—"
            : `${metrics.leads_captured} leads captured out of ${metrics.total_calls} calls (${metrics.total_calls ? Math.round((metrics.leads_captured / metrics.total_calls) * 100) : 0}%).`}
        </div>
        <div style={{ marginTop: 6, opacity: 0.7, fontSize: 13 }}>
          Want more detail? Check{" "}
          <Link href="/portal/activity" style={{ fontWeight: 800 }}>Activity</Link>{" "}
          to see call-by-call outcomes.
        </div>
      </div>

      <div style={{ marginTop: 18, ...panel() }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Recent Calls</div>
            <div style={{ opacity: 0.7, marginTop: 4 }}>Latest 25 calls for your account.</div>
          </div>
          <button onClick={load} style={btn(false)}>Refresh</button>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.8 }}>
                <th style={th()}>Time</th>
                <th style={th()}>Caller</th>
                <th style={th()}>Status</th>
                <th style={th()}>Outcome</th>
                <th style={th()}>Reason</th>
                <th style={th()}>Duration</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, opacity: 0.7 }}>Loading…</td>
                </tr>
              ) : rows.length ? (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                    <td style={td()}>{r.started_at ? new Date(r.started_at).toLocaleString() : "-"}</td>
                    <td style={td()}>{r.from_number || "-"}</td>
                    <td style={td()}>{r.status || "-"}</td>
                    <td style={td()}>
                      <span style={pill()}>{badge(r.outcome)}</span>
                    </td>
                    <td style={td()} title={r.notes || ""}>{r.call_reason || "-"}</td>
                    <td style={td()}>{r.duration_seconds == null ? "-" : fmtSec(r.duration_seconds)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: 14, opacity: 0.7 }}>No calls yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop: 14, opacity: 0.65, fontSize: 13 }}>
        Need help? <Link href="/portal/support">Support</Link>
      </p>
    </main>
  );
}

function Card({ label, value, loading }: { label: string; value: any; loading: boolean }) {
  return (
    <div style={{ ...panel(), padding: 14 }}>
      <div style={{ fontSize: 12, opacity: 0.72 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 8 }}>
        {loading ? "—" : value ?? 0}
      </div>
    </div>
  );
}

function panel() {
  return {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
  } as const;
}

function btn(active: boolean) {
  return {
    borderRadius: 999,
    padding: "8px 12px",
    border: "1px solid rgba(0,0,0,0.12)",
    background: active ? "rgba(14,122,100,0.12)" : "#fff",
    cursor: "pointer",
    fontWeight: 800,
  } as const;
}

function th() {
  return { padding: "10px 8px" } as const;
}

function td() {
  return { padding: "10px 8px", verticalAlign: "top" } as const;
}

function pill() {
  return {
    display: "inline-block",
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 999,
    padding: "4px 10px",
    fontWeight: 900,
    fontSize: 12,
    background: "rgba(0,0,0,0.03)",
  } as const;
}

function linkPill() {
  return {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    textDecoration: "none",
    color: "inherit",
    fontWeight: 800,
    background: "#fff",
  } as const;
}
