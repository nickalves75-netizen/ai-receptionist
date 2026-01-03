// src/lib/square.ts
import { randomUUID } from "crypto";

const SQUARE_BASE = "https://connect.squareup.com"; // production base

export type SquareError = {
  category?: string;
  code?: string;
  detail?: string;
  field?: string;
};

export type SquareFail = {
  ok: false;
  error: string;
  debug_id: string;
  square_trace_id?: string;
  square_errors?: SquareError[];
};

export type SquareOk<T> = {
  ok: true;
  debug_id: string;
  square_trace_id?: string;
  data: T;
};

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function pickTraceId(headers: Headers): string | undefined {
  // Square commonly returns one of these headers depending on gateway/proxy
  return (
    headers.get("square-trace-id") ||
    headers.get("x-request-id") ||
    headers.get("x-correlation-id") ||
    undefined
  );
}

async function squareFetch<T>(
  path: string,
  init: RequestInit,
  debug_id: string
): Promise<SquareOk<T> | SquareFail> {
  const token = getEnv("SQUARE_ACCESS_TOKEN");
  const res = await fetch(`${SQUARE_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      // You can pin a Square-Version if you want; optional:
      // "Square-Version": "2025-01-23",
      ...(init.headers || {}),
    },
  });

  const square_trace_id = pickTraceId(res.headers);

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const errs: SquareError[] | undefined = json?.errors;
    return {
      ok: false,
      error: `Square API error (${res.status})`,
      debug_id,
      square_trace_id,
      square_errors: errs,
    };
  }

  return {
    ok: true,
    debug_id,
    square_trace_id,
    data: json as T,
  };
}

// ------------ normalization helpers ------------
export function normalizeEmail(raw?: string): string | undefined {
  if (!raw) return undefined;
  let s = String(raw).trim().toLowerCase();

  // common speech-to-text patterns
  s = s.replace(/g\s*mail/g, "gmail");
  s = s.replace(/\s+at\s+/g, "@");
  s = s.replace(/\s+dot\s+/g, ".");
  s = s.replace(/[,\s]+/g, ""); // remove spaces/commas entirely

  // if someone literally says "at" without spaces
  s = s.replace(/(.*)at(.*)\.(.*)/, (m) => m); // no-op safety

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  return isValid ? s : undefined;
}

export function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 12 && digits.startsWith("+" )) return digits;
  // If it’s already E.164-ish:
  if (raw.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return undefined;
}

// ------------ Customers ------------
async function searchCustomerByEmail(email: string, debug_id: string) {
  // Square SearchCustomers filter format (email_address exact/fuzzy)
  // Example format shown in Square forums/docs. :contentReference[oaicite:0]{index=0}
  return squareFetch<{ customers?: any[] }>(
    "/v2/customers/search",
    {
      method: "POST",
      body: JSON.stringify({
        query: {
          filter: {
            email_address: { exact: email },
          },
        },
        limit: 1,
      }),
    },
    debug_id
  );
}

async function searchCustomerByPhone(phone: string, debug_id: string) {
  return squareFetch<{ customers?: any[] }>(
    "/v2/customers/search",
    {
      method: "POST",
      body: JSON.stringify({
        query: {
          filter: {
            phone_number: { exact: phone },
          },
        },
        limit: 1,
      }),
    },
    debug_id
  );
}

async function createCustomer(
  customer: {
    given_name?: string;
    family_name?: string;
    email_address?: string;
    phone_number?: string;
  },
  debug_id: string
) {
  return squareFetch<{ customer?: any }>(
    "/v2/customers",
    {
      method: "POST",
      body: JSON.stringify(customer),
    },
    debug_id
  );
}

export async function upsertCustomer(
  input: {
    given_name?: string;
    family_name?: string;
    email?: string;
    phone?: string;
  },
  debug_id: string
): Promise<SquareOk<{ customer_id: string }> | SquareFail> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  // Try email first, then phone
  if (email) {
    const found = await searchCustomerByEmail(email, debug_id);
    if (!found.ok) return found;
    const id = found.data.customers?.[0]?.id;
    if (id) return { ok: true, debug_id, square_trace_id: found.square_trace_id, data: { customer_id: id } };
  }

  if (phone) {
    const found = await searchCustomerByPhone(phone, debug_id);
    if (!found.ok) return found;
    const id = found.data.customers?.[0]?.id;
    if (id) return { ok: true, debug_id, square_trace_id: found.square_trace_id, data: { customer_id: id } };
  }

  // Create new customer (email optional)
  const created = await createCustomer(
    {
      given_name: input.given_name || undefined,
      family_name: input.family_name || undefined,
      email_address: email,
      phone_number: phone,
    },
    debug_id
  );
  if (!created.ok) return created;
  const newId = created.data.customer?.id;
  if (!newId) {
    return { ok: false, error: "Square customer created but no ID returned", debug_id };
  }

  return { ok: true, debug_id, square_trace_id: created.square_trace_id, data: { customer_id: newId } };
}

// ------------ Availability ------------
export async function searchAvailability(
  args: {
    location_id: string;
    service_variation_ids: string[];
    start_at: string;
    end_at: string;
  },
  debug_id: string
) {
  // Square Bookings availability/search expects start_at_range + segment_filters. :contentReference[oaicite:1]{index=1}
  const segment_filters = args.service_variation_ids.map((id) => ({
    service_variation_id: id,
  }));

  return squareFetch<any>(
    "/v2/bookings/availability/search",
    {
      method: "POST",
      body: JSON.stringify({
        query: {
          filter: {
            start_at_range: {
              start_at: args.start_at,
              end_at: args.end_at,
            },
            location_id: args.location_id,
            segment_filters,
          },
        },
      }),
    },
    debug_id
  );
}

// ------------ Booking Create ------------
export async function createBooking(
  args: {
    location_id: string;
    start_at: string;
    customer_id: string;
    customer_note?: string;
    appointment_segments: any[];
  },
  debug_id: string
) {
  const idempotency_key = randomUUID();

  // Booking fields commonly include location_id, start_at, customer_id, appointment_segments, notes. :contentReference[oaicite:2]{index=2}
  return squareFetch<any>(
    "/v2/bookings",
    {
      method: "POST",
      body: JSON.stringify({
        idempotency_key,
        booking: {
          location_id: args.location_id,
          start_at: args.start_at,
          customer_id: args.customer_id,
          customer_note: args.customer_note,
          appointment_segments: args.appointment_segments,
        },
      }),
    },
    debug_id
  );
}
