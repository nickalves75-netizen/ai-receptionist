// src/app/api/square/services/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

/**
 * GET /api/square/services?client_id=...&cursor=...
 * Returns Square Catalog ITEMs and their ITEM_VARIATION ids/versions.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("client_id");
    const cursor = url.searchParams.get("cursor") || undefined;

    if (!clientId) {
      return NextResponse.json({ ok: false, error: "Missing client_id" }, { status: 400 });
    }

    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { ok: false, error: "Server missing Supabase config" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
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

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Square catalog list failed", details: json },
        { status: 500 }
      );
    }

    const objects = Array.isArray((json as any)?.objects) ? (json as any).objects : [];

    // Build a map of variations by id
    const variationById = new Map<string, any>();
    for (const o of objects) {
      if (o?.type === "ITEM_VARIATION") variationById.set(o.id, o);
    }

    // Build compact list of items and their variations
    const items: any[] = [];
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

    return NextResponse.json(
      {
        ok: true,
        next_cursor: (json as any)?.cursor || null,
        items,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    console.error("squareServices crashed:", e);
    return NextResponse.json(
      { ok: false, error: "Server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
