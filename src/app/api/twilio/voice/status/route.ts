import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTwilioRequest } from "@/lib/twilioVerify";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify Twilio signature
  try {
    await verifyTwilioRequest(req, rawBody);
  } catch {
    // Return OK to avoid Twilio retry storms; we just ignore invalid hits
    return new Response("OK", { status: 200 });
  }

  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const callSid = String(params["CallSid"] || "");
  const callStatus = String(params["CallStatus"] || "");
  const duration = String(params["CallDuration"] || "");

  const businessId = requireEnv("DEFAULT_BUSINESS_ID");

  if (callSid) {
    await supabaseAdmin.from("calls").upsert(
      {
        business_id: businessId,
        twilio_call_sid: callSid,
        status: callStatus || null,
        ended_at:
          callStatus === "completed" || callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed"
            ? new Date().toISOString()
            : null,
        collected_data: duration ? { call_duration_seconds: Number(duration) } : undefined,
      },
      { onConflict: "twilio_call_sid" }
    );
  }

  return new Response("OK", { status: 200 });
}
