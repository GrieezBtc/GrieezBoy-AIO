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
import type { AccessStatus } from "@/lib/access";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Profile = { coins: number; premium_until: string | null };

type AuthContextValue = {
  /** false until the first session check finished */
  ready: boolean;
  /** false when the Supabase env vars are missing (site then works without accounts) */
  configured: boolean;
  user: User | null;
  status: AccessStatus;
  /** coin balance 🪙 (premium users still have a balance but do not spend it) */
  coins: number;
  /** false while the profile is still loading (or could not be read) */
  coinsKnown: boolean;
  premiumUntil: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  openPrompt: (kind: PromptKind) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prompt, setPrompt] = useState<PromptKind | null>(null);

  const loadAccount = useCallback(
    async (nextUser: User | null) => {
      if (!supabase || !nextUser) {
        setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("coins, premium_until")
        .eq("id", nextUser.id)
        .maybeSingle();
      setProfile((data as Profile | null) ?? null);
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
  }, [supabase]);

  const value = useMemo<AuthContextValue>(() => {
    const premiumUntil = profile?.premium_until ?? null;
    const isPremium = premiumUntil !== null && new Date(premiumUntil).getTime() > Date.now();

    let status: AccessStatus = "guest";
    if (user) status = isPremium ? "premium" : "member";

    return {
      ready,
      configured: supabase !== null,
      user,
      status,
      coins: profile?.coins ?? 0,
      coinsKnown: profile !== null,
      premiumUntil,
      refresh,
      signOut,
      openPrompt: setPrompt,
    };
  }, [ready, supabase, user, profile, refresh, signOut]);

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
