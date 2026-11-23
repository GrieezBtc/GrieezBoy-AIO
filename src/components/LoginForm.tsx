"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const FIELD =
  "min-h-11 w-full rounded-xl border border-line bg-[var(--glass-soft)] px-3 text-[0.9rem] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
  }, []);

  const supabase = getSupabaseBrowser();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setNotice("Account created. Check your email to confirm it, then sign in.");
          setMode("signin");
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!supabase) {
    return (
      <p className="text-[0.9rem] text-dim">
        Accounts are not switched on for this site yet.{" "}
        <Link href="/" className="text-accent">
          Back to the downloader
        </Link>
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-[var(--glass-soft)] p-1">
        {(["signin", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className="min-h-10 rounded-full text-[0.85rem] font-semibold transition-colors"
            style={
              mode === value
                ? { background: "var(--accent-soft)", color: "var(--accent)" }
                : { color: "var(--text-dim)" }
            }
          >
            {value === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="t-label">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className={`${FIELD} mt-1.5`}
        />
      </label>

      <label className="block">
        <span className="t-label">Password</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
          className={`${FIELD} mt-1.5`}
        />
      </label>

      {error ? (
        <p role="alert" className="text-[0.85rem]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-[0.85rem] text-accent">{notice}</p> : null}

      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Please wait…" : mode === "signup" ? "Create free account" : "Sign in"}
      </button>

      {mode === "signup" ? (
        <p className="text-[0.78rem] leading-relaxed text-faint">
          New accounts start with 10 🪙 free coins. Each successful download costs 1 coin.
        </p>
      ) : null}
    </form>
  );
}
