// src/app/internal/login/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

function isStaffUser(user: any): boolean {
  const role =
    user?.app_metadata?.role ??
    user?.user_metadata?.role ??
    user?.role ??
    "";

  if (typeof role === "string" && ["staff", "admin", "neais"].includes(role.toLowerCase())) {
    return true;
  }

  const allow = (process.env.NEXT_PUBLIC_NEAIS_STAFF_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const email = (user?.email ?? "").toLowerCase();
  if (allow.length && email && allow.includes(email)) return true;

  return false;
}

export default function InternalLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      const { data: u } = await supabase.auth.getUser();
      const user = u.user;

      if (isStaffUser(user)) router.replace("/internal");
      else router.replace("/");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      const email = username.trim();
      if (!email) {
        setMsg("Enter your username (email).");
        return;
      }
      if (!password) {
        setMsg("Enter your password.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message);
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      const user = u.user;

      if (isStaffUser(user)) router.replace("/internal");
      else router.replace("/internal/overview");
    } catch (err: any) {
      setMsg(err?.message ?? "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    setMsg(null);
    const email = username.trim();
    if (!email || !email.includes("@")) {
      setMsg("Type your email in Username, then click Forgot Password.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/internal/login`,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg("Password reset email sent.");
    } catch (err: any) {
      setMsg(err?.message ?? "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      {/* background */}
      <div style={styles.bg} />

      {/* center */}
      <div style={styles.centerWrap}>
        <div style={styles.iconWrap}>
          <Image src="/neais-logo.png"alt="Kallr" width={200} height={200} priority />
        </div>

        <section style={styles.card}>
          <div style={styles.cardGlow} />
          <div style={styles.cardInner}>
            <h1 style={styles.title}>Login</h1>

            <form onSubmit={onSubmit} style={styles.form}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="email"
                style={styles.input}
              />

              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                autoComplete="current-password"
                style={styles.input}
              />

              <div style={styles.forgotRow}>
                <button type="button" onClick={onForgotPassword} disabled={busy} style={styles.forgotBtn}>
                  Forgot Password
                </button>
              </div>

              {msg ? <div style={styles.msg}>{msg}</div> : null}

              <button type="submit" disabled={busy} style={styles.launchBtn}>
                {busy ? "Launching..." : "Launch Kallr"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  bg: {
    position: "absolute",
    inset: 0,
    backgroundImage: "url('/neais-logo.png')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "bottom center",
    backgroundSize: "cover",
    zIndex: 0,
  },
  centerWrap: {
    position: "relative",
    zIndex: 2,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "56px 20px",
  },
  iconWrap: {
    marginBottom: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: "translateY(-4px)",
  },

  // Card: more transparent + bold edges + sleekness
  card: {
    width: "min(820px, 94vw)",
    borderRadius: 42,
    position: "relative",
    border: "4px solid rgba(17,17,17,0.38)",
    background: "rgba(214,214,214,0.72)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow:
      "0 22px 55px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.55)",
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(1200px 600px at 50% 0%, rgba(255,255,255,0.35), transparent 60%)",
    pointerEvents: "none",
  },
  cardInner: {
    position: "relative",
    padding: "46px 54px 44px",
  },

  // Typography: “InfuseAI-like” tight + bold
  title: {
    margin: 0,
    textAlign: "center",
    fontSize: 74,
    fontWeight: 900,
    letterSpacing: "-0.045em",
    color: "#0f1115",
    textShadow: "0 2px 0 rgba(255,255,255,0.35)",
    lineHeight: 1.03,
  },

  form: {
    marginTop: 26,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  input: {
    height: 68,
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.10)",
    outline: "none",
    background: "rgba(239,239,239,0.9)",
    padding: "0 30px",
    fontSize: 18,
    fontWeight: 700,
    color: "#0f1115",
    letterSpacing: "-0.01em",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
  },

  forgotRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: -6,
    marginBottom: 0,
    paddingRight: 12,
  },
  forgotBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 800,
    color: "#0f1115",
    letterSpacing: "-0.02em",
    textDecoration: "underline",
    textUnderlineOffset: 5,
    opacity: 0.95,
  },

  msg: {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "rgba(255,255,255,0.78)",
    padding: "12px 14px",
    fontWeight: 700,
    fontSize: 13,
    color: "#0f1115",
  },

  launchBtn: {
    height: 74,
    borderRadius: 999,
    border: "6px solid rgba(255,255,255,0.92)",
    background: "#0e7a64",
    color: "white",
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    cursor: "pointer",
    boxShadow: "0 14px 26px rgba(0,0,0,0.22)",
  },
};
