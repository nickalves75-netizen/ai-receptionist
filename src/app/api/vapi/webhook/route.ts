import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const WEBHOOK_VERSION = "v2-2025-12-29";
const MAX_BODY_BYTES = 1_000_000; // 1MB safety

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function constantTimeEqual(a: string, b: string) {
  // Simple constant-time-ish compare to avoid timing attacks (good enough for this use)
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function authorized(req: NextRequest) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return true; // if not set, don't block (but you SHOULD set it before go-live)

  // Prefer header
  const headerSecret =
    req.headers.get("x-kallr-webhook-secret") ||
    req.headers.get("x-vapi-webhook-secret") ||
    "";

  // Optional fallback: query param (use only if Vapi can't send custom headers)
  const urlSecret = req.nextUrl.searchParams.get("secret") || "";

  const provided = headerSecret || urlSecret;
  if (!provided) return false;

  return constantTimeEqual(provided, secret);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveBusinessId(params: {
  vapiPhoneNumberId?: string | null;
  twilioNumber?: string | null;
  fallbackBusinessId: string;
}) {
  const { vapiPhoneNumberId, twilioNumber, fallbackBusinessId } = params;

  if (vapiPhoneNumberId) {
    const { data } = await supabaseAdmin
      .from("phone_numbers")
      .select("business_id")
      .eq("vapi_phone_number_id", vapiPhoneNumberId)
      .eq("active", true)
      .maybeSingle();
    if (data?.business_id) return String(data.business_id);
  }

  if (twilioNumber) {
    const { data } = await supabaseAdmin
      .from("phone_numbers")
      .select("business_id")
      .eq("twilio_number", twilioNumber)
      .eq("active", true)
      .maybeSingle();
    if (data?.business_id) return String(data.business_id);
  }

  return fallbackBusinessId;
}

async function fetchVapiCall(callId: string) {
  const key = process.env.VAPI_API_KEY;
  if (!key) return null;

  const resp = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!resp.ok) return null;
  return resp.json();
}

function truncateForStorage(obj: any, maxChars = 20_000) {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= maxChars) return obj;
    return { __truncated: true, length: s.length, preview: s.slice(0, maxChars) };
  } catch {
    return { __unserializable: true };
  }
}

export async function GET() {
  return new Response(`VAPI WEBHOOK OK (${WEBHOOK_VERSION})`, { status: 200 });
}

export async function POST(req: NextRequest) {
  // 0) Require shared secret
  if (!authorized(req)) {
    // 401 is correct; prevents random internet spam from writing to your DB
    return new Response("Unauthorized", { status: 401 });
  }

  const fallbackBusinessId = requireEnv("DEFAULT_BUSINESS_ID");

  // 1) Read body safely
  const raw = await req.text().catch(() => "");
  if (!raw) return new Response("Bad Request", { status: 400 });
  if (raw.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });

  const body = (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })();
  if (!body) return new Response("Bad Request", { status: 400 });

  // Vapi often sends: { message: { type, call, phoneNumber, artifact, ... } }
  const msg = body?.message ?? body;
  const eventType: string | null = msg?.type ?? null;
  const call = msg?.call ?? body?.call ?? null;

  const vapiCallId: string | null = call?.id ?? msg?.callId ?? body?.callId ?? null;

  const twilioCallSid: string | null =
    call?.transport?.callSid ?? call?.phoneCallProviderId ?? msg?.callSid ?? body?.callSid ?? null;

  const callKey = (twilioCallSid ?? vapiCallId) ? String(twilioCallSid ?? vapiCallId) : null;

  // If we can't identify the call, do NOT write junk rows
  if (!callKey) return new Response("OK (no call key)", { status: 200 });

  const vapiPhoneNumberId: string | null = msg?.phoneNumber?.id ?? call?.phoneNumberId ?? call?.phoneNumber?.id ?? null;

  const toNumber: string | null =
    msg?.phoneNumber?.number ?? call?.phoneNumber?.number ?? call?.to ?? body?.to ?? null;

  const fromNumber: string | null = call?.customer?.number ?? msg?.customer?.number ?? body?.from ?? null;

  const startedAt: string | null = call?.startedAt ?? msg?.startedAt ?? body?.startedAt ?? call?.createdAt ?? null;
  const endedAt: string | null = call?.endedAt ?? msg?.endedAt ?? body?.endedAt ?? null;

  const artifact = msg?.artifact ?? call?.artifact ?? null;
  const transcriptRaw = artifact?.transcript ?? call?.transcript ?? msg?.transcript ?? null;

  const transcriptText =
    typeof transcriptRaw === "string" ? transcriptRaw : transcriptRaw ? JSON.stringify(transcriptRaw) : null;

  const businessId = await resolveBusinessId({
    vapiPhoneNumberId,
    twilioNumber: toNumber,
    fallbackBusinessId,
  });

  const status = endedAt ? "completed" : "handled";

  // 2) Store call immediately (store truncated payload to avoid giant rows)
  const { data: rows, error } = await supabaseAdmin
    .from("calls")
    .upsert(
      {
        business_id: businessId,
        twilio_call_sid: callKey,
        vapi_call_id: vapiCallId ? String(vapiCallId) : null,
        vapi_phone_number_id: vapiPhoneNumberId ? String(vapiPhoneNumberId) : null,
        from_number: fromNumber ? String(fromNumber) : null,
        to_number: toNumber ? String(toNumber) : null,
        status,
        transcript: transcriptText ?? "",
        intent: null,
        collected_data: {
          source: "vapi",
          webhook_version: WEBHOOK_VERSION,
          event_type: eventType,
          extracted: {
            callKey,
            twilioCallSid: twilioCallSid ? String(twilioCallSid) : null,
            vapiCallId: vapiCallId ? String(vapiCallId) : null,
            vapiPhoneNumberId: vapiPhoneNumberId ? String(vapiPhoneNumberId) : null,
            fromNumber: fromNumber ? String(fromNumber) : null,
            toNumber: toNumber ? String(toNumber) : null,
          },
          raw_truncated: truncateForStorage(body),
        },
        started_at: startedAt ? new Date(startedAt).toISOString() : null,
        ended_at: endedAt ? new Date(endedAt).toISOString() : null,
      },
      { onConflict: "twilio_call_sid" }
    )
    .select("id, business_id, vapi_call_id")
    .limit(1);

  if (error) return new Response(`DB error: ${error.message}`, { status: 500 });

  // 3) If ended and we have vapi call id, enrich shortly after
  const callRow = rows?.[0];
  const vapiIdForFetch = callRow?.vapi_call_id ?? (vapiCallId ? String(vapiCallId) : null);

  if (endedAt && vapiIdForFetch) {
    await sleep(2500);

    const callDetail = await fetchVapiCall(vapiIdForFetch);
    if (callDetail) {
      const callObj = (callDetail as any)?.call ?? callDetail;
      const structuredOutputs = callObj?.artifact?.structuredOutputs ?? null;

      await supabaseAdmin.from("calls").upsert(
        {
          business_id: businessId,
          twilio_call_sid: callKey,
          vapi_call_id: vapiIdForFetch,
          vapi_phone_number_id: vapiPhoneNumberId ? String(vapiPhoneNumberId) : null,
          from_number: fromNumber ? String(fromNumber) : null,
          to_number: toNumber ? String(toNumber) : null,
          status: "completed",
          transcript: transcriptText ?? "",
          intent: null,
          collected_data: {
            source: "vapi",
            webhook_version: WEBHOOK_VERSION,
            event_type: eventType,
            structured_outputs: structuredOutputs,
            raw_truncated: truncateForStorage(body),
            vapi_call_truncated: truncateForStorage(callDetail),
          },
          started_at: startedAt ? new Date(startedAt).toISOString() : null,
          ended_at: endedAt ? new Date(endedAt).toISOString() : null,
        },
        { onConflict: "twilio_call_sid" }
      );
    }
  }

  return new Response("OK", { status: 200 });
}
