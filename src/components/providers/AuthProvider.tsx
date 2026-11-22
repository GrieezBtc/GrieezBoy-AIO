"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AccessDialog, type PromptKind } from "@/components/AccessDialog";
import { DAILY_LIMIT, TRIAL_DAYS, type AccessStatus } from "@/lib/access";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Profile = { trial_ends_at: string; premium_until: string | null };

type AuthContextValue = {
  /** false until the first session check finished */
  ready: boolean;
  /** false when the Supabase env vars are missing (site then works without accounts) */
  configured: boolean;
  user: User | null;
  status: AccessStatus;
  trialDaysLeft: number;
  usedToday: number;
  remainingToday: number;
  premiumUntil: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  openPrompt: (kind: PromptKind) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function lagosToday(): string {
  // en-CA formats as YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usedToday, setUsedToday] = useState(0);
  const [prompt, setPrompt] = useState<PromptKind | null>(null);

  const loadAccount = useCallback(
    async (nextUser: User | null) => {
      if (!supabase || !nextUser) {
        setProfile(null);
        setUsedToday(0);
        return;
      }
      const [profileRes, usageRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("trial_ends_at, premium_until")
          .eq("id", nextUser.id)
          .maybeSingle(),
        supabase
          .from("usage")
          .select("count")
          .eq("user_id", nextUser.id)
          .eq("day", lagosToday())
          .maybeSingle(),
      ]);
      setProfile((profileRes.data as Profile | null) ?? null);
      setUsedToday((usageRes.data as { count: number } | null)?.count ?? 0);
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      await loadAccount(sessionUser);
      if (!cancelled) setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      // never await supabase calls inside this callback
      setTimeout(() => void loadAccount(sessionUser), 0);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase, loadAccount]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    await loadAccount(data.session?.user ?? null);
  }, [supabase, loadAccount]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setUsedToday(0);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(() => {
    const now = Date.now();
    const premiumUntil = profile?.premium_until ?? null;
    const isPremium = premiumUntil !== null && new Date(premiumUntil).getTime() > now;
    const trialEnd = profile ? new Date(profile.trial_ends_at).getTime() : now + TRIAL_DAYS * 86_400_000;
    const trialActive = trialEnd > now;

    let status: AccessStatus = "guest";
    if (user) status = isPremium ? "premium" : trialActive ? "trial" : "trial_expired";

    return {
      ready,
      configured: supabase !== null,
      user,
      status,
      trialDaysLeft: Math.max(0, Math.ceil((trialEnd - now) / 86_400_000)),
      usedToday,
      remainingToday: Math.max(0, DAILY_LIMIT - usedToday),
      premiumUntil,
      refresh,
      signOut,
      openPrompt: setPrompt,
    };
  }, [ready, supabase, user, profile, usedToday, refresh, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AccessDialog kind={prompt} email={user?.email ?? null} onClose={() => setPrompt(null)} />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
