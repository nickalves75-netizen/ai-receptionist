import { NextRequest } from "next/server";
import twilio from "twilio";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTwilioRequest } from "@/lib/twilioVerify";
import { receptionistTurn } from "@/lib/aiReceptionist";

function twimlResponse(xml: string) {
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function normYesNo(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAffirmative(raw: string): boolean {
  const t = normYesNo(raw);
  return t === "yes" || t === "yeah" || t === "yep" || t === "correct" || t === "right" || t.startsWith("yes ");
}

function isNegative(raw: string): boolean {
  const t = normYesNo(raw);
  return t === "no" || t === "nope" || t === "nah" || t === "incorrect" || t.startsWith("no ");
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

async function logMessage(businessId: string, phone: string, direction: string, body: string) {
  await supabaseAdmin.from("messages").insert({
    business_id: businessId,
    phone,
    direction,
    body,
  });
}

async function sendSummarySmsOnce(opts: { businessId: string; callSid: string; toNumber: string; collected: any }) {
  const { businessId, callSid, toNumber, collected } = opts;
  if (!toNumber) return;
  if (collected?.__sms_sent) return;

  const recap = summarizeCollected(collected);
  const body =
    `Thanks for calling! Here’s what I have:\n` +
    `${recap}\n\n` +
    `Reply YES to confirm or text any changes.`;

  await logMessage(businessId, toNumber, "outbound_attempt", body);

  try {
    const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
    const authToken = requireEnv("TWILIO_AUTH_TOKEN");
    const twilioFrom = requireEnv("TWILIO_PHONE_NUMBER");
    const client = twilio(accountSid, authToken);

    if (process.env.SMS_ENABLED !== "true") {
  return Response.json({ ok: true, skipped: "sms_disabled" }, { status: 200 });
}


    const msg = await client.messages.create({ to: toNumber, from: twilioFrom, body });
    await logMessage(businessId, toNumber, "outbound_queued", `SID:${msg.sid}`);

    const updatedCollected = { ...collected, __sms_sent: true, __sms_sid: msg.sid };
    await supabaseAdmin.from("calls").update({ collected_data: updatedCollected }).eq("twilio_call_sid", callSid);
  } catch (err: any) {
    const m = err?.message ? String(err.message) : "Unknown SMS send error";
    await logMessage(businessId, toNumber, "outbound_error", m);
  }
}

function makeGather(vr: twilio.twiml.VoiceResponse, prompt: string) {
  const g = vr.gather({
    input: ["speech"],
    action: "/api/twilio/voice",
    method: "POST",
    timeout: 10,
    speechTimeout: "2", // ✅ FIX: must be string per Twilio typings
    language: "en-US",
  });

  g.say({ voice: "Polly.Joanna", language: "en-US" }, prompt);

  vr.say({ voice: "Polly.Joanna", language: "en-US" }, "No worries. Thanks for calling. Goodbye.");
  vr.hangup();

  return g;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    await verifyTwilioRequest(req, rawBody);
  } catch {
    const vr = new twilio.twiml.VoiceResponse();
    vr.say("Unable to process this call right now. Goodbye.");
    vr.hangup();
    return twimlResponse(vr.toString());
  }

  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const callSid = String(params["CallSid"] || "");
  const from = String(params["From"] || "");
  const speech = String(params["SpeechResult"] || "").trim();

  const businessId = requireEnv("DEFAULT_BUSINESS_ID");
  const vr = new twilio.twiml.VoiceResponse();

  if (callSid) {
    await supabaseAdmin.from("calls").upsert(
      {
        business_id: businessId,
        twilio_call_sid: callSid,
        from_number: from || null,
        status: "in-progress",
      },
      { onConflict: "twilio_call_sid" }
    );
  }

  let existingCollected: any = {};
  if (callSid) {
    const { data } = await supabaseAdmin
      .from("calls")
      .select("collected_data")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();
    existingCollected = (data?.collected_data ?? {}) as any;
  }

  const state = String(existingCollected.__state || "collect"); // collect | confirm | done
  const priorTranscript = typeof existingCollected.__transcript === "string" ? existingCollected.__transcript : "";

  if (!speech) {
    makeGather(vr, "Thanks for calling. I’m the virtual receptionist. Take your time — what can I help you with today?");
    return twimlResponse(vr.toString());
  }

  const newTranscript = `${priorTranscript}${priorTranscript ? "\n" : ""}${speech}`;

  if (state === "confirm") {
    if (isAffirmative(speech)) {
      const updatedCollected = { ...existingCollected, __state: "done", __transcript: newTranscript };

      if (callSid) {
        await supabaseAdmin
          .from("calls")
          .update({
            transcript: newTranscript,
            status: "completed",
            ended_at: new Date().toISOString(),
            collected_data: updatedCollected,
          })
          .eq("twilio_call_sid", callSid);

        await sendSummarySmsOnce({ businessId, callSid, toNumber: from, collected: updatedCollected });
      }

      vr.say({ voice: "Polly.Joanna", language: "en-US" }, "Perfect — you’re all set. Goodbye.");
      vr.hangup();
      return twimlResponse(vr.toString());
    }

    if (isNegative(speech)) {
      const updatedCollected = { ...existingCollected, __state: "collect", __transcript: newTranscript };

      if (callSid) {
        await supabaseAdmin
          .from("calls")
          .update({
            transcript: newTranscript,
            status: "handled",
            collected_data: updatedCollected,
          })
          .eq("twilio_call_sid", callSid);
      }

      makeGather(vr, "No problem at all — what should I change?");
      return twimlResponse(vr.toString());
    }

    makeGather(vr, "Just say yes or no — is that correct?");
    return twimlResponse(vr.toString());
  }

  const turn = await receptionistTurn(existingCollected, speech);
  const nextState = turn.done ? "confirm" : "collect";

  const collectedNext = {
    ...turn.merged,
    __state: nextState,
    __transcript: newTranscript,
  };

  if (callSid) {
    await supabaseAdmin
      .from("calls")
      .update({
        transcript: newTranscript,
        intent: turn.merged.intent,
        collected_data: collectedNext,
        status: "handled",
      })
      .eq("twilio_call_sid", callSid);

    if (nextState === "confirm") {
      await sendSummarySmsOnce({ businessId, callSid, toNumber: from, collected: collectedNext });
    }
  }

  const reply = `Got it. ${turn.speakable_reply}`;
  makeGather(vr, reply);
  return twimlResponse(vr.toString());
}

