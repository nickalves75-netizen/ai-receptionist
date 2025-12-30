"use client";

import { useEffect, useMemo, useState } from "react";
import s from "../../portal.module.css";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

type ReqRow = {
  id: string;
  created_at: string;
  subject: string;
  body: string;
  status: string;
};

export default function PortalSupportPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<ReqRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadBiz() {
      const { data, error } = await supabase.from("business_memberships").select("business_id").limit(1);
      if (!mounted) return;
      if (error) return setErr(error.message);
      setBusinessId(data?.[0]?.business_id ?? null);
    }
    loadBiz();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function loadRequests() {
    if (!businessId) return;
    const { data, error } = await supabase
      .from("support_requests")
      .select("id, created_at, subject, body, status")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) setErr(error.message);
    setRows((data as any) ?? []);
  }

  useEffect(() => {
    if (!businessId) return;
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function submit() {
    if (!businessId) return;
    setBusy(true);
    setMsg(null);
    setErr(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error("Not logged in.");

      const { error } = await supabase.from("support_requests").insert({
        business_id: businessId,
        user_id: userId,
        subject,
        body,
      });

      if (error) throw error;

      setSubject("");
      setBody("");
      setMsg("Request submitted. Our team will handle it shortly.");
      await loadRequests();
    } catch (e: any) {
      setErr(e?.message || "Could not submit request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={s.topRow}>
        <div>
          <h1 className={s.h1}>Support</h1>
          <div className={s.sub}>Request changes or report issues.</div>
        </div>
      </div>

      {(err || msg) && <div className={s.sub}>{err || msg}</div>}

      <div className={s.grid}>
        <div className={`${s.card} ${s.cardWide}`}>
          <div className={s.cardTitle}>New Request</div>
          <div className={s.formRow}>
            <input
              className={s.input}
              placeholder="Subject (ex: Update greeting, Change forwarding number, Add service...)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              className={s.textarea}
              placeholder="Describe what you want changed. Include any details and preferred timing."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button className={s.primaryBtn} onClick={submit} disabled={busy || !subject || !body}>
              {busy ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </div>

        <div className={`${s.card} ${s.cardWide}`}>
          <div className={s.cardTitle}>Recent Requests</div>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.th}>Time</th>
                <th className={s.th}>Subject</th>
                <th className={s.th}>Status</th>
                <th className={s.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={s.td}>{new Date(r.created_at).toLocaleString()}</td>
                  <td className={s.td}>{r.subject}</td>
                  <td className={s.td}>
                    <span className={`${s.badge} ${r.status === "open" ? s.badgeGreen : ""}`}>{r.status}</span>
                  </td>
                  <td className={s.td}>{r.body.slice(0, 70) + (r.body.length > 70 ? "…" : "")}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className={s.td} colSpan={4}>No requests yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
