"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import s from "../../portal.module.css";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function PortalLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onLogin() {
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/portal");
    } catch (e: any) {
      setMsg(e?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    setBusy(true);
    setMsg(null);
    try {
      // IMPORTANT: change this to your production domain later:
      // e.g. https://kallr.ai/portal/login
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/portal/login` : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      setMsg("Password reset email sent. Check your inbox.");
    } catch (e: any) {
      setMsg(e?.message || "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.centerAuth}>
      <div className={s.authCard}>
        <h1 className={s.authTitle}>Client Portal</h1>
        <div className={s.authSub}>
          {mode === "login"
            ? "New User? Please login here with your provided Kallr account to see your dashboard."
            : "Enter your email and we’ll send a password reset link."}
        </div>

        <div className={s.formRow}>
          <input
            className={s.input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          {mode === "login" && (
            <input
              className={s.input}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          )}

          {msg && <div className={s.authSub}>{msg}</div>}

          {mode === "login" ? (
            <>
              <button className={s.primaryBtn} onClick={onLogin} disabled={busy || !email || !password}>
                {busy ? "Signing in…" : "Sign in"}
              </button>

              <button className={s.linkBtn} onClick={() => setMode("forgot")} disabled={busy}>
                Forgot password?
              </button>
            </>
          ) : (
            <>
              <button className={s.primaryBtn} onClick={onForgot} disabled={busy || !email}>
                {busy ? "Sending…" : "Send reset email"}
              </button>

              <button className={s.linkBtn} onClick={() => setMode("login")} disabled={busy}>
                Back to login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
