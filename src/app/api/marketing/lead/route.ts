// src/app/api/marketing/lead/route.ts
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function json(status: number, payload: any) {
  return Response.json(payload, { status });
}

function bad(detail: string, status = 400) {
  return json(status, { error: "bad_request", detail });
}

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function getClientIp(req: NextRequest) {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";

  return "unknown";
}

async function enforceRateLimit(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = (req.headers.get("user-agent") || "unknown").slice(0, 180);

  const keyBase = `marketing_lead:${ip}:${ua}`;

  const burst = await supabaseAdmin.rpc("check_rate_limit", {
    p_key: `${keyBase}:m1`,
    p_window_seconds: 60,
    p_max: 6,
  });

  if (burst.error) {
    return { ok: true as const, note: `rate_limit_rpc_error: ${burst.error.message}` };
  }

  const burstRow = Array.isArray(burst.data) ? burst.data[0] : burst.data;
  if (burstRow && burstRow.allowed === false) {
    return { ok: false as const, status: 429, detail: "Too many requests. Please try again shortly." };
  }

  const hour = await supabaseAdmin.rpc("check_rate_limit", {
    p_key: `${keyBase}:h1`,
    p_window_seconds: 60 * 60,
    p_max: 40,
  });

  if (hour.error) {
    return { ok: true as const, note: `rate_limit_rpc_error: ${hour.error.message}` };
  }

  const hourRow = Array.isArray(hour.data) ? hour.data[0] : hour.data;
  if (hourRow && hourRow.allowed === false) {
    return { ok: false as const, status: 429, detail: "Too many requests. Please try again later." };
  }

  return { ok: true as const };
}

// Optional Turnstile verification hook (only enforces if TURNSTILE_SECRET_KEY exists)
async function verifyTurnstile(token: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true as const, skipped: true as const };

  if (!token) return { ok: false as const, detail: "Bot verification failed (missing token)." };

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  const data: any = await resp.json().catch(() => null);
  if (!data?.success) return { ok: false as const, detail: "Bot verification failed." };

  return { ok: true as const, skipped: false as const };
}

function getPublicBase() {
  return (
    (process.env.NEAIS_PUBLIC_BASE_URL || process.env.NEAIS_PUBLIC_BASE_URL || "").replace(/\/+$/, "")
  );
}

function leadEmailHtml(args: {
  lead_id: string | null;
  source: string;
  name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  website: string;
  url: string;
}) {
  const base = getPublicBase();
  const internalLeadUrl = args.lead_id
    ? base
      ? `${base}/internal/leads/${args.lead_id}`
      : `/internal/leads/${args.lead_id}`
    : base
    ? `${base}/internal`
    : `/internal`;

  const row = (k: string, v: string) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;color:#6b7280;font-size:13px;width:170px;">${k}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;color:#111827;font-size:13px;">${v}</td>
    </tr>
  `;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:#f6f7f8; padding:24px;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <div style="padding:18px 20px;background:linear-gradient(135deg,#0aa07f,#0e7a64);color:#fff;">
        <div style="font-size:16px;font-weight:800;letter-spacing:.2px;">New Lead — NEAIS</div>
        <div style="opacity:.9;font-size:13px;margin-top:4px;">Source: ${esc(args.source)}</div>
      </div>

      <div style="padding:18px 20px;">
        <table style="width:100%;border-collapse:collapse;">
          ${row("Lead ID", esc(args.lead_id || "—"))}
          ${row("Name", esc(args.name))}
          ${row(
            "Email",
            `<a href="mailto:${esc(args.email)}" style="color:#0e7a64;text-decoration:none;">${esc(args.email)}</a>`
          )}
          ${row("Phone", esc(args.phone || "—"))}
          ${row("Company", esc(args.company_name || "—"))}
          ${row(
            "Website",
            `<a href="${esc(args.website)}" style="color:#0e7a64;text-decoration:none;">${esc(args.website)}</a>`
          )}
          ${row(
            "Submitted from URL",
            `<a href="${esc(args.url)}" style="color:#0e7a64;text-decoration:none;">${esc(args.url)}</a>`
          )}
        </table>

        <div style="margin-top:16px;">
          <a href="${esc(internalLeadUrl)}"
             style="display:inline-block;background:#0e7a64;color:#fff;text-decoration:none;font-weight:700;
                    padding:10px 14px;border-radius:10px;">
            View in Internal Dashboard
          </a>
        </div>

        <div style="margin-top:14px;color:#6b7280;font-size:12px;">
          If the button doesn’t work, open: ${esc(internalLeadUrl)}
        </div>
      </div>
    </div>
  </div>`;
}

async function sendLeadEmail(args: {
  lead_id: string | null;
  source: string;
  name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  website: string;
  url: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  const toList = (process.env.NEAIS_LEAD_NOTIFY_EMAILS || process.env.NEAIS_LEAD_NOTIFY_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const from =
    process.env.NEAIS_FROM_EMAIL || process.env.NEAIS
    _FROM_EMAIL || "NEAIS <onboarding@resend.dev>";

  // If not configured yet, silently skip (do not break lead flow)
  if (!apiKey || !toList.length) {
    return {
      ok: false as const,
      skipped: true as const,
      detail: "Email not configured (missing RESEND_API_KEY or NEAIS_LEAD_NOTIFY_EMAILS).",
    };
  }

  const subject = `New lead: ${args.name}${args.company_name ? ` — ${args.company_name}` : ""}`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: toList,
      subject,
      html: leadEmailHtml(args),
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    return { ok: false as const, skipped: false as const, detail: `Resend error: HTTP ${resp.status} ${txt}` };
  }

  return { ok: true as const, skipped: false as const };
}

export async function POST(req: NextRequest) {
  try {
    // 1) Rate limiting
    const rl = await enforceRateLimit(req);
    if (!rl.ok) return json(rl.status, { error: "rate_limited", detail: rl.detail });

    // 2) Parse body
    const body = await req.json().catch(() => null);
    if (!body) return bad("Invalid JSON body");

    // 3) Optional bot verification
    const turnstileToken = body.turnstileToken ? safeStr(body.turnstileToken).trim() : null;
    const tv = await verifyTurnstile(turnstileToken);
    if (!tv.ok) return json(403, { error: "bot_check_failed", detail: tv.detail });

    // 4) Validate fields
    const url = safeStr(body.url).trim();
    const source = safeStr(body.source).trim();
    const name = safeStr(body.name).trim();
    const email = safeStr(body.email).trim();

    const phone = body.phone ? safeStr(body.phone).trim() : null;
    const company_name = body.companyName ? safeStr(body.companyName).trim() : null;
    const current_website = body.currentWebsite ? safeStr(body.currentWebsite).trim() : null;

    const assessmentRaw = body.data ?? {};
    const assessment =
      assessmentRaw && typeof assessmentRaw === "object" && !Array.isArray(assessmentRaw) ? assessmentRaw : {};

    if (!url) return bad("Missing url");
    if (!source) return bad("Missing source");
    if (!name) return bad("Missing name");
    if (!email || !email.includes("@")) return bad("Missing/invalid email");

    // 5) Insert lead row
    const leadInsert = {
      stage: "new",
      source,
      full_name: name,
      name,
      email,
      phone,
      company_name,
      website: current_website || url,
      assessment: { ...assessment, url },
    };

    const leadRes = await supabaseAdmin.from("leads").insert(leadInsert).select("id");
    if (leadRes.error) {
      return json(500, { error: "db_error", detail: `leads insert failed: ${leadRes.error.message}` });
    }

    const lead_id = Array.isArray(leadRes.data) && leadRes.data.length ? leadRes.data[0]?.id : null;

    // 6) Also store into marketing_leads (non-blocking)
    let warning: string | null = null;

    const mlRes = await supabaseAdmin.from("marketing_leads").insert({
      url,
      source,
      name,
      email,
      phone,
      company_name,
      current_website,
      assessment,
      lead_id,
    });

    if (mlRes.error) {
      warning = `marketing_leads insert skipped: ${mlRes.error.message}`;
    }

    // 7) Email notify (non-blocking)
    const emailRes = await sendLeadEmail({
      lead_id,
      source,
      name,
      email,
      phone,
      company_name,
      website: current_website || url,
      url,
    });

    if (!emailRes.ok) {
      warning = warning ? `${warning} | ${emailRes.detail}` : emailRes.detail;
    }

    return json(200, { ok: true, lead_id, warning });
  } catch (e: any) {
    return json(500, { error: "server_error", detail: e?.message ? String(e.message) : "Unknown error" });
  }
}
