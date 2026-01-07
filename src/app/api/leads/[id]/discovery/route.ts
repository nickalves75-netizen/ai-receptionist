// src/app/api/leads/[id]/discovery/route.ts
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: any, status = 200) {
  return Response.json(data, { status });
}

function bad(detail: string, status = 400) {
  return json({ error: "bad_request", detail }, status);
}

function isStaff(user: any): boolean {
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role ?? user?.role ?? "";
  if (typeof role === "string" && ["staff", "admin", "neais", "neais"].includes(role.toLowerCase())) return true;

  const allow = (process.env.NEAIS_STAFF_EMAILS ?? process.env.NEAIS_STAFF_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const email = (user?.email ?? "").toLowerCase();
  if (allow.length && email && allow.includes(email)) return true;

  return false;
}

async function requireStaff() {
  const sb = await createSupabaseServer();
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) redirect("/internal/login");

  const { data: u } = await sb.auth.getUser();
  if (!isStaff(u.user)) redirect("/");

  return u.user;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function asObj(v: any): Record<string, any> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, any>;
  return {};
}

// GET /api/leads/:id/discovery
export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireStaff();

  const { id: rawId } = await ctx.params;
  const id = String(rawId || "").trim();
  if (!isUuid(id)) return bad("Invalid lead id");

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id, discovery, discovery_status, discovery_updated_at, discovery_completed_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return json({ error: "db_error", detail: error.message }, 500);
  if (!data) return json({ error: "not_found" }, 404);

  return json({
    ok: true,
    id: data.id,
    discovery: data.discovery ?? {},
    discovery_status: data.discovery_status ?? "not_started",
    discovery_updated_at: data.discovery_updated_at ?? null,
    discovery_completed_at: data.discovery_completed_at ?? null,
  });
}

// PUT /api/leads/:id/discovery
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireStaff();

  const { id: rawId } = await ctx.params;
  const id = String(rawId || "").trim();
  if (!isUuid(id)) return bad("Invalid lead id");

  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON body");

  // Accept multiple shapes so we never “break” the client:
  // { discovery: {...}, status?: "in_progress"|"complete", complete?: boolean }
  // or just { ...discoveryFields }
  const incomingDiscovery = body.discovery && typeof body.discovery === "object" ? asObj(body.discovery) : asObj(body);

  const statusRaw = String(body.status ?? body.discovery_status ?? "").trim().toLowerCase();
  const wantsComplete = Boolean(body.complete) || statusRaw === "complete";

  const nowIso = new Date().toISOString();

  // Merge with existing discovery so partial saves don’t wipe earlier steps
  const { data: prevRow, error: prevErr } = await supabaseAdmin.from("leads").select("discovery").eq("id", id).maybeSingle();

  if (prevErr) return json({ error: "db_error", detail: prevErr.message }, 500);

  const prevDiscovery = asObj((prevRow as any)?.discovery);
  const mergedDiscovery = { ...prevDiscovery, ...incomingDiscovery };

  const update: any = {
    discovery: mergedDiscovery,
    discovery_status: wantsComplete ? "complete" : "in_progress",
    discovery_updated_at: nowIso,
  };

  if (wantsComplete) {
    update.discovery_completed_at = nowIso;
  }

  const { error: upErr } = await supabaseAdmin.from("leads").update(update).eq("id", id);
  if (upErr) return json({ error: "db_error", detail: upErr.message }, 500);

  return json({ ok: true });
}
