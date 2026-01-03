// src/app/api/utils/time/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function nowPayload() {
  const now = new Date();
  return {
    ok: true,
    now_utc: now.toISOString(),
    now_epoch_ms: Date.now(),
  };
}

export async function GET() {
  return NextResponse.json(nowPayload(), { status: 200 });
}

export async function POST() {
  return NextResponse.json(nowPayload(), { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
