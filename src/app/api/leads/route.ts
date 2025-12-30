import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { source, data } = await req.json();

    const assessment = data ?? {};

    const payload = {
  source: source || "unknown",
  stage: "new",
  full_name: data?.fullName || data?.contactName || null,
  name: data?.fullName || data?.contactName || null,
  email: data?.email || null,
  phone: data?.phone || null,
  company_name: data?.companyName || null,
  website: data?.currentWebsite || null,

  // ✅ clean storage
  intake: {
    companyName: data?.companyName || "",
    contactName: data?.contactName || "",
    phone: data?.phone || "",
    email: data?.email || "",
    industry: data?.industry || "",
    leadType: data?.leadType || "",
    referralName: data?.referralName || "",
    kallrRep: data?.kallrRep || "",
  },

  // keep for legacy if you want (optional)
  assessment: data || null,
};


    // ✅ Return the inserted id so the Sales Studio can route to /internal/leads/:id
    const { data: inserted, error } = await supabaseAdmin
      .from("leads")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: inserted?.id });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}