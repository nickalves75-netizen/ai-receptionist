import OpenAI from "openai";

/* ------------------ Types ------------------ */

export type ReceptionistIntent =
  | "booking"
  | "service_request"
  | "pricing"
  | "hours"
  | "other";

export type ReceptionistData = {
  intent: ReceptionistIntent;
  caller_name: string | null;
  service: string | null;
  vehicle_or_item: string | null;
  location: string | null;
  preferred_time: string | null;
  notes: string | null;
};

export type ReceptionistTurn = {
  merged: ReceptionistData;
  done: boolean;
  speakable_reply: string;
  short_summary: string;
};

/* ------------------ Helpers ------------------ */

function emptyData(): ReceptionistData {
  return {
    intent: "other",
    caller_name: null,
    service: null,
    vehicle_or_item: null,
    location: null,
    preferred_time: null,
    notes: null,
  };
}

function normalize(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function mergeData(
  prev: ReceptionistData,
  next: Partial<ReceptionistData>
): ReceptionistData {
  return {
    intent: (next.intent as ReceptionistIntent) || prev.intent,
    caller_name: normalize(next.caller_name) ?? prev.caller_name,
    service: normalize(next.service) ?? prev.service,
    vehicle_or_item:
      normalize(next.vehicle_or_item) ?? prev.vehicle_or_item,
    location: normalize(next.location) ?? prev.location,
    preferred_time:
      normalize(next.preferred_time) ?? prev.preferred_time,
    notes: normalize(next.notes) ?? prev.notes,
  };
}

function needsBookingFields(d: ReceptionistData): boolean {
  return !d.service || !d.location || !d.preferred_time;
}

function nextQuestion(d: ReceptionistData): string {
  if (!d.service) return "What service are you looking for?";
  if (!d.location) return "What city or address should we come to?";
  if (!d.preferred_time) return "What day and time works best for you?";
  if (!d.vehicle_or_item) return "What kind of vehicle is it?";
  if (!d.caller_name) return "What name should I put this under?";
  return "Anything else you’d like me to note?";
}

function summarize(d: ReceptionistData): string {
  return [
    d.intent && `Intent: ${d.intent}`,
    d.caller_name && `Name: ${d.caller_name}`,
    d.service && `Service: ${d.service}`,
    d.vehicle_or_item && `Vehicle: ${d.vehicle_or_item}`,
    d.location && `Location: ${d.location}`,
    d.preferred_time && `Time: ${d.preferred_time}`,
    d.notes && `Notes: ${d.notes}`,
  ]
    .filter(Boolean)
    .join(" | ");
}

/* ------------------ Fallback (No AI) ------------------ */

function fallbackTurn(
  prev: ReceptionistData,
  speech: string
): ReceptionistTurn {
  const merged = mergeData(prev, {
    notes: speech || prev.notes,
  });

  const bookingLike =
    merged.intent === "booking" ||
    merged.intent === "service_request";

  const needMore = bookingLike && needsBookingFields(merged);

  return {
    merged,
    done: !needMore,
    speakable_reply: needMore
      ? `Got it. ${nextQuestion(merged)}`
      : "Thanks, I’ve got that noted. You’re all set.",
    short_summary: summarize(merged) || "Caller provided limited info.",
  };
}

/* ------------------ Main Turn Logic ------------------ */

export async function receptionistTurn(
  prevRaw: unknown,
  userSpeech: string
): Promise<ReceptionistTurn> {
  const prev =
    prevRaw && typeof prevRaw === "object"
      ? (prevRaw as ReceptionistData)
      : emptyData();

  const apiKey = process.env.OPENAI_API_KEY;

  // Safe fallback if OpenAI is not configured
  if (!apiKey || apiKey.trim().length < 10) {
    return fallbackTurn(prev, userSpeech);
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `
You are a professional, friendly AI receptionist for a service business.

You receive:
- previous_data (JSON)
- caller_speech (string)

Extract ONLY what the caller explicitly says.
Return ONLY valid JSON in this schema:

{
  "intent": "booking"|"service_request"|"pricing"|"hours"|"other",
  "caller_name": string|null,
  "service": string|null,
  "vehicle_or_item": string|null,
  "location": string|null,
  "preferred_time": string|null,
  "notes": string|null
}

Rules:
- Do NOT guess missing details.
- Use null if not stated.
- booking/service_request only if they want service performed.
`;

  const userPayload = JSON.stringify({
    previous_data: prev,
    caller_speech: userSpeech,
  });

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt.trim() },
      { role: "user", content: userPayload },
    ],
  });

  let extracted: Partial<ReceptionistData> = {};
  try {
    extracted = JSON.parse(
      resp.choices[0]?.message?.content || "{}"
    );
  } catch {
    return fallbackTurn(prev, userSpeech);
  }

  const merged = mergeData(prev, extracted);

  const bookingLike =
    merged.intent === "booking" ||
    merged.intent === "service_request";

  const needMore = bookingLike && needsBookingFields(merged);

  return {
    merged,
    done: !needMore,
    speakable_reply: needMore
      ? nextQuestion(merged)
      : `Perfect. Just to confirm: ${merged.service}, in ${merged.location}, ${merged.preferred_time}. Is that correct?`,
    short_summary: summarize(merged),
  };
}
