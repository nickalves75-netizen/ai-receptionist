// src/app/app/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function CustomerAppHome() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getSession();
  if (!data.session) redirect("/internal/login");

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 22 }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 950, letterSpacing: "-0.04em", color: "#0f172a" }}>
        Customer Dashboard
      </h1>
      <p style={{ marginTop: 8, fontWeight: 850, color: "rgba(15,23,42,0.64)" }}>
        This is the client-facing portal. Next step: call stats, transcripts, booking outcomes, and AI settings.
      </p>

      <div
        style={{
          marginTop: 14,
          background: "white",
          border: "1px solid rgba(17,24,39,0.12)",
          borderRadius: 18,
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 950, color: "#0f172a" }}>Coming next</div>
        <ul style={{ marginTop: 10, fontWeight: 850, color: "rgba(15,23,42,0.72)" }}>
          <li>Calls answered / missed / booked</li>
          <li>Recent transcripts + recordings</li>
          <li>Business hours + escalation contacts</li>
          <li>AI tone + FAQ approvals</li>
        </ul>
      </div>
    </main>
  );
}
