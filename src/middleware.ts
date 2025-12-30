// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isStaffUser(user: any): boolean {
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

// Safe baseline security headers (won't break Next/Supabase)
function applySecurityHeaders(res: NextResponse) {
  // Basic hardening
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Reduce powerful browser APIs availability by default
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Cross-origin isolation baselines
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-site");

  // HSTS (only meaningful on HTTPS; harmless on localhost)
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  return res;
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

  // Refresh session + get user (this is the “real” gate)
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  // INTERNAL protection
  if (pathname.startsWith("/internal") && !pathname.startsWith("/internal/login")) {
    if (!user) {
      const r = NextResponse.redirect(new URL("/internal/login", req.url));
      return applySecurityHeaders(r);
    }
    if (!isStaffUser(user)) {
      const r = NextResponse.redirect(new URL("/", req.url));
      return applySecurityHeaders(r);
    }
  }

  // CUSTOMER PORTAL protection
  // Allow the portal login route publicly; protect everything else under /portal
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