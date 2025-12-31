// src/app/api/square/services/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function pick(v: any, keys: string[]) {
  const out: any = {};
  for (const k of keys) out[k] = v?.[k];
  return out;
}

/**
 * GET /api/square/services?client_id=...&cursor=...
 * Returns Square Catalog ITEMs and their ITEM_VARIATION ids/versions.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  const cursor = url.searchParams.get("cursor") || undefined;

  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Missing client_id" }, { status: 400 });
  }

  const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("square_access_token")
    .eq("id", clientId)
    .single();

  if (clientErr || !client?.square_access_token) {
    return NextResponse.json(
      { ok: false, error: "Client missing Square connection", details: clientErr },
      { status: 400 }
    );
  }

  const listUrl = new URL("https://connect.squareup.com/v2/catalog/list");
  listUrl.searchParams.set("types", "ITEM,ITEM_VARIATION");
  if (cursor) listUrl.searchParams.set("cursor", cursor);

  const res = await fetch(listUrl.toString(), {
    headers: {
      Authorization: `Bearer ${client.square_access_token}`,
      "Content-Type": "application/json",
      "Square-Version": process.env.SQUARE_VERSION || "2025-01-23",
    },
  });

  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Square catalog list failed", details: json }, { status: 500 });
  }

  const objects = Array.isArray(json?.objects) ? json.objects : [];

  // Build a map of variations by id
  const variationById = new Map<string, any>();
  for (const o of objects) {
    if (o?.type === "ITEM_VARIATION") variationById.set(o.id, o);
  }

  // Build compact list of items and their variations
  const items = [];
  for (const o of objects) {
    if (o?.type !== "ITEM") continue;

    const name = o?.item_data?.name || "(unnamed)";
    const variations = (o?.item_data?.variations || [])
      .map((v: any) => {
        const fullVar = variationById.get(v?.id) || v;
        const vName = fullVar?.item_variation_data?.name || v?.item_variation_data?.name || "";
        return {
          name: vName,
          service_variation_id: fullVar?.id,
          service_variation_version: fullVar?.version,
        };
      })
      .filter((v: any) => v.service_variation_id);

    items.push({
      item_id: o.id,
      item_version: o.version,
      name,
      variations,
    });
  }

  return NextResponse.json({
    ok: true,
    next_cursor: json?.cursor || null,
    items,
  });
}
