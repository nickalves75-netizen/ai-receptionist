import { NextRequest } from "next/server";
import twilio from "twilio";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTwilioRequest } from "@/lib/twilioVerify";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function summarizeCollected(c: any): string {
  const service = c?.service ? String(c.service) : "";
  const location = c?.location ? String(c.location) : "";
  const time = c?.preferred_time ? String(c.preferred_time) : "";
  const vehicle = c?.vehicle_or_item ? String(c.vehicle_or_item) : "";
  const name = c?.caller_name ? String(c.caller_name) : "";

  const parts = [
    service && `Service: ${service}`,
    vehicle && `Vehicle: ${vehicle}`,
    location && `Location: ${location}`,
    time && `Time: ${time}`,
    name && `Name: ${name}`,
  ].filter(Boolean);

  return parts.length ? parts.join(" • ") : "We captured your request, but a few details may be missing.";
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    await verifyTwilioRequest(req, rawBody);
  } catch {
    return new Response("OK", { status: 200 });
  }

  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const callSid = String(params["CallSid"] || "");
  const callStatus = String(params["CallStatus"] || "");
  const duration = String(params["CallDuration"] || "");

  const businessId = requireEnv("DEFAULT_BUSINESS_ID");

  if (!callSid) return new Response("OK", { status: 200 });

  // Pull existing row so we can merge (and avoid double-sending SMS)
  const existing = await supabaseAdmin
    .from("calls")
    .select("from_number, collected_data")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();

  const fromNumber = String(existing.data?.from_number || params["From"] || "");
  const existingCollected = (existing.data?.collected_data ?? {}) as any;

  const mergedCollected = {
    ...existingCollected,
    ...(duration ? { call_duration_seconds: Number(duration) } : {}),
  };

  // Always upsert status + merged collected_data
  await supabaseAdmin.from("calls").upsert(
    {
      business_id: businessId,
      twilio_call_sid: callSid,
      status: callStatus || null,
      ended_at:
        callStatus === "completed" ||
        callStatus === "no-answer" ||
        callStatus === "busy" ||
        callStatus === "failed"
          ? new Date().toISOString()
          : null,
      collected_data: mergedCollected,
    },
    { onConflict: "twilio_call_sid" }
  );

  // Send 1 SMS only when completed
  if (callStatus === "completed" && fromNumber) {
    if (!mergedCollected.__sms_sent) {
      const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
      const authToken = requireEnv("TWILIO_AUTH_TOKEN");
      const twilioFrom = requireEnv("TWILIO_PHONE_NUMBER");

      const client = twilio(accountSid, authToken);

      const recap = summarizeCollected(mergedCollected);

      const body =
        `Thanks for calling! Here’s what I have:\n` +
        `${recap}\n\n` +
        `Reply YES to confirm or text any changes.`;

        if (process.env.SMS_ENABLED !== "true") {
  return Response.json({ ok: true, skipped: "sms_disabled" }, { status: 200 });
}


      await client.messages.create({
        to: fromNumber,
        from: twilioFrom,
        body,
      });

      // Mark sent so we never double-text on retries
      const updatedCollected = { ...mergedCollected, __sms_sent: true };

      await supabaseAdmin
        .from("calls")
        .update({ collected_data: updatedCollected })
        .eq("twilio_call_sid", callSid);
    }
  }

  return new Response("OK", { status: 200 });
}
