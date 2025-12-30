"use client";

import { useEffect, useMemo, useState } from "react";
import s from "../../portal.module.css";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

type CallRow = {
  id: string;
  started_at: string | null;
  status: string | null;
  from_number: string | null;
  to_number: string | null;
  transcript: string | null;
  collected_data: any;
};

type MsgRow = {
  id: string;
  created_at: string;
  direction: string | null;
  phone: string | null;
  body: string | null;
};

export default function PortalActivityPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [msgs, setMsgs] = useState<MsgRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadBiz() {
      const { data, error } = await supabase
        .from("business_memberships")
        .select("business_id")
        .limit(1);

      if (!mounted) return;
      if (error) {
        setErr(error.message);
        return;
      }
      setBusinessId(data?.[0]?.business_id ?? null);
    }

    loadBiz();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!businessId) return;
    let mounted = true;

    async function load() {
      setErr(null);

      const { data: c, error: ce } = await supabase
        .from("calls")
        .select("id, started_at, status, from_number, to_number, transcript, collected_data")
        .eq("business_id", businessId)
        .order("started_at", { ascending: false })
        .limit(50);

      const { data: m, error: me } = await supabase
        .from("messages")
        .select("id, created_at, direction, phone, body")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!mounted) return;

      if (ce) setErr(ce.message);
      if (me) setErr((prev) => prev ? prev + " | " + me.message : me.message);

      setCalls((c as any) ?? []);
      setMsgs((m as any) ?? []);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [businessId, supabase]);

  return (
    <>
      <div className={s.topRow}>
        <div>
          <h1 className={s.h1}>Activity</h1>
          <div className={s.sub}>Recent calls and message attempts.</div>
        </div>
      </div>

      {err && <div className={s.sub}>{err}</div>}

      <div className={`${s.card} ${s.cardWide}`}>
        <div className={s.cardTitle}>Recent Calls</div>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.th}>Time</th>
              <th className={s.th}>From</th>
              <th className={s.th}>Status</th>
              <th className={s.th}>Duration</th>
              <th className={s.th}>Transcript</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => {
              const dur = c?.collected_data?.call_duration_seconds;
              return (
                <tr key={c.id}>
                  <td className={s.td}>{c.started_at ? new Date(c.started_at).toLocaleString() : "—"}</td>
                  <td className={s.td}>{c.from_number || "—"}</td>
                  <td className={s.td}>
                    <span className={`${s.badge} ${c.status === "handled" ? s.badgeGreen : ""}`}>
                      {c.status || "—"}
                    </span>
                  </td>
                  <td className={s.td}>{dur ? `${dur}s` : "—"}</td>
                  <td className={s.td}>{c.transcript ? c.transcript.slice(0, 60) + (c.transcript.length > 60 ? "…" : "") : "—"}</td>
                </tr>
              );
            })}
            {calls.length === 0 && (
              <tr>
                <td className={s.td} colSpan={5}>No calls yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ height: 12 }} />

      <div className={`${s.card} ${s.cardWide}`}>
        <div className={s.cardTitle}>Recent Messages</div>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.th}>Time</th>
              <th className={s.th}>Direction</th>
              <th className={s.th}>Phone</th>
              <th className={s.th}>Body</th>
            </tr>
          </thead>
          <tbody>
            {msgs.map((m) => (
              <tr key={m.id}>
                <td className={s.td}>{new Date(m.created_at).toLocaleString()}</td>
                <td className={s.td}>{m.direction || "—"}</td>
                <td className={s.td}>{m.phone || "—"}</td>
                <td className={s.td}>{m.body || "—"}</td>
              </tr>
            ))}
            {msgs.length === 0 && (
              <tr>
                <td className={s.td} colSpan={4}>No messages yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
