import { NextResponse } from "next/server";

/**
 * Square Bookings Create (STRICT) — v2
 * Adds:
 *  - GET version check
 *  - Returns Square error bodies to the caller for debugging
 */

const VERSION = "strict_v2";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: VERSION,
    route: "/api/square/bookings/create",
  });
}


type CreateBookingInput = {
  start_at: string; // RFC3339 exact slot
  location_id: string;

  team_member_id: string;
  service_variation_id: string;
  service_variation_version?: number;
  duration_minutes: number;

  customer: {
    first_name: string;
    last_name: string;
    phone: string;
    email?: string;
  };

  appointment_address: string;

  notes?: string;
  vehicle?: { make_model?: string; color?: string };
  referral_source?: string;
};

function getSquareBaseUrl() {
  const env = (process.env.SQUARE_ENV || "production").toLowerCase();
  return env === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function isRfc3339(s: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+\-]\d{2}:\d{2})$/.test(s);
}

function normalizePhone(phone: string) {
  const raw = (phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

function jsonErr(status: number, error: string, details?: any) {
  return NextResponse.json({ ok: false, error, details }, { status });
}

async function squareFetch(path: string, body: any) {
  const baseUrl = getSquareBaseUrl();
  const token = mustEnv("SQUARE_ACCESS_TOKEN");

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "square-version": "2025-08-20",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { res, json };
}

async function findOrCreateCustomer(input: CreateBookingInput, requestId: string) {
  const phone = normalizePhone(input.customer.phone);

  // Search by phone first
  if (phone) {
    const searchBody = {
      query: {
        filter: {
          phone_number: { exact: phone },
        },
      },
      limit: 1,
    };

    const { res, json } = await squareFetch("/v2/customers/search", searchBody);

    console.log(
      JSON.stringify({
        requestId,
        at: "square.customers.search",
        ok: res.ok,
        status: res.status,
        phone,
        square: json,
      })
    );

    if (res.ok && json?.customers?.length) {
      return { customer_id: json.customers[0].id as string, phone };
    }
  }

  // Create customer
  const createBody: any = {
    given_name: input.customer.first_name,
    family_name: input.customer.last_name,
  };
  if (phone) createBody.phone_number = phone;
  if (input.customer.email) createBody.email_address = input.customer.email;

  const lines: string[] = [];
  if (input.appointment_address) lines.push(`Address: ${input.appointment_address}`);
  if (input.vehicle?.make_model) lines.push(`Vehicle: ${input.vehicle.make_model}`);
  if (input.vehicle?.color) lines.push(`Color: ${input.vehicle.color}`);
  if (input.referral_source) lines.push(`Referral: ${input.referral_source}`);
  if (lines.length) createBody.note = lines.join(" | ");

  const { res, json } = await squareFetch("/v2/customers", createBody);

  console.log(
    JSON.stringify({
      requestId,
      at: "square.customers.create",
      ok: res.ok,
      status: res.status,
      phone,
      square: json,
    })
  );

  if (!res.ok || !json?.customer?.id) {
    return { error: "Square customer create failed", details: json };
  }

  return { customer_id: json.customer.id as string, phone };
}



export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  let input: CreateBookingInput | null = null;
  try {
    input = (await req.json()) as CreateBookingInput;
  } catch {
    return jsonErr(400, "Invalid JSON body");
  }

  // STRICT validation
  const missing: string[] = [];
  if (!input?.start_at) missing.push("start_at");
  if (!input?.location_id) missing.push("location_id");
  if (!input?.team_member_id) missing.push("team_member_id");
  if (!input?.service_variation_id) missing.push("service_variation_id");
  if (!input?.duration_minutes) missing.push("duration_minutes");
  if (!input?.customer?.first_name) missing.push("customer.first_name");
  if (!input?.customer?.last_name) missing.push("customer.last_name");
  if (!input?.customer?.phone) missing.push("customer.phone");
  if (!input?.appointment_address) missing.push("appointment_address");

  if (missing.length) {
    console.log(
      JSON.stringify({
        requestId,
        at: "square.bookings.create.reject_missing",
        missing,
        received: input,
      })
    );
    return jsonErr(400, "Missing required fields", { missing, requestId });
  }

  if (!isRfc3339(input.start_at)) {
    return jsonErr(400, "start_at must be RFC3339 (ex: 2026-01-07T16:00:00Z)", { requestId });
  }

  const normalizedPhone = normalizePhone(input.customer.phone);
  if (!normalizedPhone || normalizedPhone.length < 8) {
    return jsonErr(400, "customer.phone is invalid (need a real phone number)", {
      requestId,
      received: input.customer.phone,
    });
  }

  console.log(
    JSON.stringify({
      requestId,
      at: "square.bookings.create.request",
      version: VERSION,
      start_at: input.start_at,
      location_id: input.location_id,
      team_member_id: input.team_member_id,
      service_variation_id: input.service_variation_id,
      service_variation_version: input.service_variation_version,
      duration_minutes: input.duration_minutes,
      customer: {
        first_name: input.customer.first_name,
        last_name: input.customer.last_name,
        phone: normalizedPhone,
        email: input.customer.email || null,
      },
      appointment_address: input.appointment_address,
    })
  );

  // 1) Customer
  const cust = await findOrCreateCustomer(input, requestId);
  if ((cust as any).error) {
    return jsonErr(502, "Failed to create/find Square customer", {
      requestId,
      square: (cust as any).details,
      hint:
        "If square shows 'ACCESS_DENIED' or permissions errors, your Square token is missing CUSTOMERS_READ/CUSTOMERS_WRITE scopes.",
    });
  }

  // 2) Booking create
  const idempotency_key = crypto.randomUUID();

  const bookingBody: any = {
    idempotency_key,
    booking: {
      start_at: input.start_at,
      location_id: input.location_id,
      customer_id: (cust as any).customer_id,
      customer_note: input.notes || "",
      seller_note: [
        `Mobile Address: ${input.appointment_address}`,
        input.vehicle?.make_model ? `Vehicle: ${input.vehicle.make_model}` : null,
        input.vehicle?.color ? `Color: ${input.vehicle.color}` : null,
        input.referral_source ? `Referral: ${input.referral_source}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
      appointment_segments: [
        {
          team_member_id: input.team_member_id,
          service_variation_id: input.service_variation_id,
          service_variation_version: input.service_variation_version,
          duration_minutes: input.duration_minutes,
        },
      ],
    },
  };

  const { res, json } = await squareFetch("/v2/bookings", bookingBody);

  console.log(
    JSON.stringify({
      requestId,
      at: "square.bookings.create.response",
      ok: res.ok,
      status: res.status,
      square: json,
    })
  );

  if (!res.ok) {
    return jsonErr(502, "Square booking create failed", { requestId, square: json });
  }

  return NextResponse.json({
    ok: true,
    requestId,
    booking: json?.booking || null,
  });
}
