import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Square Bookings Create (STRICT) — v3
 * - GET: health/version check (fixes your 405 test in browser)
 * - POST: upserts customer (simple + safe) then creates booking
 * - Returns Square error bodies for debugging
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERSION = "strict_v3";

type CreateBookingInput = {
  start_at: string; // MUST be exact slot start ISO string (e.g. 2026-01-07T16:00:00Z)
  location_id: string;

  team_member_id: string;
  service_variation_id: string;
  service_variation_version?: number;
  duration_minutes: number;

  customer: {
    first_name: string;
    last_name: string;
    phone: string; // required
    email?: string; // optional
  };

  appointment_address: string; // freeform (we store in notes to avoid Square address shape failures)
  notes?: string;
  vehicle?: { make_model?: string; color?: string };
  referral_source?: string;
};

function jsonError(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function squareBaseUrl() {
  const env = (process.env.SQUARE_ENV || "").toLowerCase();
  return env === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}

function squareHeaders() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("Missing SQUARE_ACCESS_TOKEN");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    // If you already set a different Square-Version elsewhere, it's fine — this is a safe default.
    "Square-Version": "2024-06-04",
  };
}

function normalizePhoneToE164(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return s;

  // Already E.164
  if (s.startsWith("+")) return s;

  // Strip non-digits
  const digits = s.replace(/\D/g, "");

  // US default behavior
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // Fallback: just prefix + (may still fail, but better than raw formatting)
  return `+${digits}`;
}

function safeStr(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function isIsoDateString(v: string) {
  // simple check — Square will validate strictly, but this prevents obvious garbage
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v);
}

async function squareFetch(path: string, init: RequestInit) {
  const url = `${squareBaseUrl()}${path}`;
  const res = await fetch(url, init);
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

async function upsertCustomer(input: CreateBookingInput) {
  const first = safeStr(input.customer.first_name);
  const last = safeStr(input.customer.last_name);
  const phone = normalizePhoneToE164(input.customer.phone);
  const email = safeStr(input.customer.email || "");

  if (!first || !last) throw new Error("Customer first_name and last_name are required");
  if (!phone) throw new Error("Customer phone is required");

  // 1) Try search by phone/email (best-effort; if it fails, we still create)
  // NOTE: Square customer search supports a filter query; if Square rejects, we fall back safely.
  let foundId: string | null = null;

  try {
    const searchBody: any = {
      limit: 1,
      query: {
        filter: {
          // We try both if available
          ...(phone ? { phone_number: { exact: phone } } : {}),
          ...(email ? { email_address: { exact: email } } : {}),
        },
      },
    };

    const search = await squareFetch("/v2/customers/search", {
      method: "POST",
      headers: squareHeaders(),
      body: JSON.stringify(searchBody),
    });

    if (search.ok && search.body?.customers?.length) {
      foundId = search.body.customers[0]?.id || null;
    }
  } catch {
    // ignore search failure
  }

  if (foundId) return foundId;

  // 2) Create customer (keep it minimal to avoid validation failures)
  const noteParts: string[] = [];
  if (input.vehicle?.make_model) noteParts.push(`Vehicle: ${input.vehicle.make_model}`);
  if (input.vehicle?.color) noteParts.push(`Color: ${input.vehicle.color}`);
  if (input.referral_source) noteParts.push(`Referral: ${input.referral_source}`);
  if (input.appointment_address) noteParts.push(`Default Address: ${input.appointment_address}`);
  const note = noteParts.join(" | ").slice(0, 500);

  const createBody: any = {
    idempotency_key: crypto.randomUUID(),
    given_name: first,
    family_name: last,
    phone_number: phone,
    ...(email ? { email_address: email } : {}),
    ...(note ? { note } : {}),
  };

  const created = await squareFetch("/v2/customers", {
    method: "POST",
    headers: squareHeaders(),
    body: JSON.stringify(createBody),
  });

  if (!created.ok) {
    return { error: "Failed to create Square customer", details: created.body, status: created.status };
  }

  const id = created.body?.customer?.id;
  if (!id) {
    return { error: "Square customer create returned no customer.id", details: created.body, status: 502 };
  }

  return id as string;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: VERSION,
    route: "/api/square/bookings/create",
    env: (process.env.SQUARE_ENV || "sandbox").toLowerCase(),
  });
}

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as CreateBookingInput;

    // Validate required booking bits
    if (!input || typeof input !== "object") {
      return jsonError(400, { ok: false, error: "Missing JSON body" });
    }

    if (!isIsoDateString(input.start_at)) {
      return jsonError(400, {
        ok: false,
        error: "start_at must be an ISO timestamp string (exact slot start)",
        got: input.start_at,
      });
    }

    if (!safeStr(input.location_id)) return jsonError(400, { ok: false, error: "location_id required" });
    if (!safeStr(input.team_member_id)) return jsonError(400, { ok: false, error: "team_member_id required" });
    if (!safeStr(input.service_variation_id))
      return jsonError(400, { ok: false, error: "service_variation_id required" });

    if (!Number.isFinite(input.duration_minutes) || input.duration_minutes <= 0) {
      return jsonError(400, { ok: false, error: "duration_minutes must be a positive number" });
    }

    // Upsert customer
    const customerIdOrErr = await upsertCustomer(input);
    if (typeof customerIdOrErr !== "string") {
      return jsonError(customerIdOrErr.status || 502, {
        ok: false,
        error: customerIdOrErr.error,
        details: customerIdOrErr.details,
        version: VERSION,
      });
    }
    const customer_id = customerIdOrErr;

    // Build notes (address MUST be captured; Square appointment address is complex, so store in notes reliably)
    const noteLines: string[] = [];
    if (input.appointment_address) noteLines.push(`Appointment Address: ${input.appointment_address}`);
    if (input.vehicle?.make_model) noteLines.push(`Vehicle: ${input.vehicle.make_model}`);
    if (input.vehicle?.color) noteLines.push(`Color: ${input.vehicle.color}`);
    if (input.referral_source) noteLines.push(`Referral: ${input.referral_source}`);
    if (input.notes) noteLines.push(`Notes: ${input.notes}`);

    const customer_note = noteLines.join("\n").slice(0, 1000);

    // Create booking
    const bookingBody: any = {
      idempotency_key: crypto.randomUUID(),
      booking: {
        start_at: input.start_at,
        location_id: input.location_id,
        customer_id,
        appointment_segments: [
          {
            duration_minutes: input.duration_minutes,
            team_member_id: input.team_member_id,
            service_variation_id: input.service_variation_id,
            ...(Number.isFinite(input.service_variation_version)
              ? { service_variation_version: input.service_variation_version }
              : {}),
          },
        ],
        ...(customer_note ? { customer_note } : {}),
      },
    };

    const created = await squareFetch("/v2/bookings", {
      method: "POST",
      headers: squareHeaders(),
      body: JSON.stringify(bookingBody),
    });

    if (!created.ok) {
      return jsonError(created.status, {
        ok: false,
        error: "Square booking create failed",
        details: created.body,
        version: VERSION,
      });
    }

    return NextResponse.json({
      ok: true,
      version: VERSION,
      customer_id,
      booking: created.body?.booking || created.body,
    });
  } catch (err: any) {
    return jsonError(500, {
      ok: false,
      error: err?.message || "Unknown error",
      version: VERSION,
    });
  }
}
