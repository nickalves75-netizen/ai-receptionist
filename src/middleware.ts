// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function applySecurityHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-site");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return res;
}

function isStaffByMetadataOrAllowlist(user: any): boolean {
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role ?? user?.role ?? "";
  if (typeof role === "string" && ["staff", "admin", "kallr"].includes(role.toLowerCase())) return true;

  const allow = (process.env.KALLR_STAFF_EMAILS ?? process.env.NEXT_PUBLIC_KALLR_STAFF_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const email = (user?.email ?? "").toLowerCase();
  if (allow.length && email && allow.includes(email)) return true;

  return false;
}

async function isStaffUser(
  supabase: ReturnType<typeof createServerClient>,
  user: any
): Promise<boolean> {
  // 1) Fast pass: metadata/env allowlist
  if (isStaffByMetadataOrAllowlist(user)) return true;

  // 2) Source of truth: staff_users table
  try {
    const { data, error } = await supabase
      .from("staff_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });
  res = applySecurityHeaders(res);

  const pathname = req.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Get user (the “real” gate)
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  // INTERNAL protection
  if (pathname.startsWith("/internal") && !pathname.startsWith("/internal/login")) {
    if (!user) {
      const r = NextResponse.redirect(new URL("/internal/login", req.url));
      return applySecurityHeaders(r);
    }

    const ok = await isStaffUser(supabase, user);
    if (!ok) {
      const r = NextResponse.redirect(new URL("/", req.url));
      return applySecurityHeaders(r);
    }
  }

  // CUSTOMER PORTAL protection
  if (pathname.startsWith("/portal")) {
    const isPortalLogin = pathname === "/portal/login";
    if (!isPortalLogin && !user) {
      const r = NextResponse.redirect(new URL("/portal/login", req.url));
      return applySecurityHeaders(r);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};