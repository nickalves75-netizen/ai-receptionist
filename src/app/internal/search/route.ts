import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isStaff(user: any): boolean {
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role ?? user?.role ?? "";
  if (typeof role === "string" && ["staff", "admin", "kallr"].includes(role.toLowerCase())) return true;

  const allow = (process.env.KALLR_STAFF_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const email = (user?.email ?? "").toLowerCase();
  if (allow.length && email && allow.includes(email)) return true;

  return false;
}

function safe(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("q") ?? "").trim();

  const q = raw.slice(0, 80);
  if (!q) {
    return NextResponse.json(
      { ok: true, items: [] },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const sb = await createSupabaseServer();

  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data: u } = await sb.auth.getUser();
  if (!isStaff(u.user)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const like = `%${q.replaceAll("%", "").replaceAll("_", "")}%`;

  // 1) Exact-ID match if they paste a full UUID
  let exact: any[] = [];
  if (isUuid(q)) {
    const { data: exactData } = await sb
      .from("leads")
      .select("id, full_name, name, company_name, email, phone, stage, created_at")
      .eq("id", q)
      .limit(1);

    exact = exactData ?? [];
  }

  // 2) Typeahead match on text fields (+ attempt partial id match via cast, with safe fallback)
  const baseSelect = "id, full_name, name, company_name, email, phone, stage, created_at";

  const orWithIdCast = `full_name.ilike.${like},name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like},id::text.ilike.${like}`;
  const orWithoutIdCast = `full_name.ilike.${like},name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`;

  let data: any[] | null = null;
  let errorMsg: string | null = null;

  // Try with id::text (works on many PostgREST setups), fallback if not supported
  {
    const { data: d1, error: e1 } = await sb
      .from("leads")
      .select(baseSelect)
      .or(orWithIdCast)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!e1) data = d1 ?? [];
    else {
      const { data: d2, error: e2 } = await sb
        .from("leads")
        .select(baseSelect)
        .or(orWithoutIdCast)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!e2) data = d2 ?? [];
      else errorMsg = e2.message;
    }
  }

  if (errorMsg) {
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 400 });
  }

  const combined = [...exact, ...(data ?? [])];

  // unique by id
  const seen = new Set<string>();
  const items = combined
    .filter((l: any) => {
      const id = String(l.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 10)
    .map((l: any) => {
      const display =
        safe(l.company_name) ||
        safe(l.full_name) ||
        safe(l.name) ||
        safe(l.email) ||
        `Lead ${safe(l.id).slice(0, 6)}`;

      return {
        id: String(l.id),
        display,
        email: safe(l.email),
        phone: safe(l.phone),
        stage: safe(l.stage || "new"),
      };
    });

  return NextResponse.json(
    { ok: true, items },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}