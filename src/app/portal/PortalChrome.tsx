
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import s from "./portal.module.css";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

function active(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function PortalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [bizName, setBizName] = useState<string>("");

  // Protect (app) routes
  useEffect(() => {
    let mounted = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session) {
        router.replace("/portal/login");
        return;
      }

      // Pull business name (first membership)
      const { data: mems } = await supabase
        .from("business_memberships")
        .select("business_id, role")
        .limit(5);

      const businessId = mems?.[0]?.business_id;
      if (businessId) {
        const { data: biz } = await supabase
          .from("businesses")
          .select("name")
          .eq("id", businessId)
          .single();
        if (biz?.name) setBizName(biz.name);
      }

      setLoading(false);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/portal/login");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, supabase]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/portal/login");
  }

  if (loading) {
    return (
      <div className={s.shell}>
        <div className={s.sidebar}>
          <div className={s.brand}>
            <div className={s.brandTitle}>NEAIS Portal</div>
            <div className={s.brandSub}>Loading…</div>
          </div>
        </div>
        <main className={s.main}>Loading…</main>
      </div>
    );
  }

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <div className={s.brandTitle}>NEAIS Portal</div>
          <div className={s.brandSub}>{bizName || "Your account"}</div>
        </div>

        <nav className={s.nav}>
          <Link href="/portal">
            <div className={`${s.navItem} ${active(pathname, "/portal") && pathname === "/portal" ? s.navActive : ""}`}>
              Overview
            </div>
          </Link>

          <Link href="/portal/activity">
            <div className={`${s.navItem} ${active(pathname, "/portal/activity") ? s.navActive : ""}`}>
              Activity
            </div>
          </Link>

          <Link href="/portal/leads">
            <div className={`${s.navItem} ${active(pathname, "/portal/leads") ? s.navActive : ""}`}>
              Leads
            </div>
          </Link>

          <Link href="/portal/support">
            <div className={`${s.navItem} ${active(pathname, "/portal/support") ? s.navActive : ""}`}>
              Support
            </div>
          </Link>
        </nav>

        <div className={s.footer}>
          <button className={s.smallBtn} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <main className={s.main}>{children}</main>
    </div>
  );
}