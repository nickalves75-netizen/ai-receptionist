"use client";

import { useEffect, useMemo, useState } from "react";
import s from "../../portal.module.css";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

type LeadRow = {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  intent: string | null;
  notes: string | null;
};

export default function PortalLeadsPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [rows, setRows] = useState<LeadRow[]>([]);
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

  useEffect(() => {
    if (!businessId) return;
    let mounted = true;

    async function load() {
      setErr(null);
      const { data, error } = await supabase
        .from("customer_leads")
        .select("id, created_at, name, phone, email, intent, notes")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!mounted) return;
      if (error) setErr(error.message);
      setRows((data as any) ?? []);
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
          <h1 className={s.h1}>Leads</h1>
          <div className={s.sub}>Leads captured by your receptionist.</div>
        </div>
      </div>

      {err && <div className={s.sub}>{err}</div>}

      <div className={`${s.card} ${s.cardWide}`}>
        <div className={s.cardTitle}>Lead List</div>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.th}>Time</th>
              <th className={s.th}>Name</th>
              <th className={s.th}>Phone</th>
              <th className={s.th}>Email</th>
              <th className={s.th}>Intent</th>
              <th className={s.th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={s.td}>{new Date(r.created_at).toLocaleString()}</td>
                <td className={s.td}>{r.name || "—"}</td>
                <td className={s.td}>{r.phone || "—"}</td>
                <td className={s.td}>{r.email || "—"}</td>
                <td className={s.td}>{r.intent || "—"}</td>
                <td className={s.td}>{r.notes ? r.notes.slice(0, 60) + (r.notes.length > 60 ? "…" : "") : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className={s.td} colSpan={6}>No leads yet (we’ll start writing here once we wire Vapi structured output).</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
