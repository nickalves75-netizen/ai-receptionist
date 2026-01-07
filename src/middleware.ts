// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Safe baseline security headers (won't break Next/Supabase)
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

function emailAllowlisted(user: any): boolean {
  const allow = (process.env.NEAIS_STAFF_EMAILS ?? process.env.NEXT_PUBLIC_NEAIS_STAFF_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const email = (user?.email ?? "").toLowerCase();
  return !!(allow.length && email && allow.includes(email));
}

async function isStaffByTable(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("staff_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return false;
  return !!data;
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

  // get user from session
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  // INTERNAL protection
  if (pathname.startsWith("/internal") && !pathname.startsWith("/internal/login")) {
    if (!user) {
      const r = NextResponse.redirect(new URL("/internal/login", req.url));
      return applySecurityHeaders(r);
    }

    // Pass if allowlisted email OR exists in staff_users table
    const ok = emailAllowlisted(user) || (await isStaffByTable(supabase, user.id));

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
  matcher: ["/internal/:path*", "/portal/:path*"],
};

