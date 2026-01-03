import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const debug_id = crypto.randomUUID();

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing SQUARE_ACCESS_TOKEN", debug_id }, { status: 500 });
  }

  const res = await fetch("https://connect.squareup.com/v2/locations", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const square_trace_id =
    res.headers.get("square-trace-id") ||
    res.headers.get("x-request-id") ||
    undefined;

  let json: any = null;
  try { json = await res.json(); } catch {}

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: `Square API error (${res.status})`, debug_id, square_trace_id, square_errors: json?.errors },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { ok: true, debug_id, square_trace_id, locations: json?.locations || [] },
    { status: 200 }
  );
}
