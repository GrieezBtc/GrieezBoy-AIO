"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type UserRow = {
  id: string;
  email: string;
  coins: number;
  premium_until: string | null;
  created_at: string;
};
type Grant = { created_at: string; admin_email: string; user_email: string | null; amount: number };

const QUICK = [10, 50, 100];

function UserCard({ user, onChanged }: { user: UserRow; onChanged: (coins: number) => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const premium = user.premium_until && new Date(user.premium_until).getTime() > Date.now();

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const supabase = getSupabaseBrowser();
    const value = Number(amount);
    if (!supabase) return;
    if (!Number.isInteger(value) || value === 0 || Math.abs(value) > 1000) {
      setNote({ ok: false, text: "Enter a whole number between -1000 and 1000 (not 0)." });
      return;
    }
    const verb = value > 0 ? `Send ${value} coins to` : `Remove ${Math.abs(value)} coins from`;
    if (!window.confirm(`${verb} ${user.email}?`)) return;

    setBusy(true);
    setNote(null);
    const { data, error } = await supabase.rpc("admin_add_coins", {
      p_user: user.id,
      p_amount: value,
    });
    setBusy(false);
    if (error) {
      setNote({ ok: false, text: error.message });
      return;
    }
    const coins = (data as { coins: number }).coins;
    onChanged(coins);
    setAmount("");
    setNote({ ok: true, text: `Done. New balance: 🪙 ${coins.toLocaleString()}` });
  };

  return (
    <li className="panel-flat p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[0.9rem] font-semibold">{user.email}</p>
          <p className="text-[0.75rem] text-faint">
            Joined {new Date(user.created_at).toLocaleDateString()}
            {premium ? " · Premium" : ""}
          </p>
        </div>
        <p className="text-xl font-bold tabular-nums">🪙 {user.coins.toLocaleString()}</p>
      </div>

      <form onSubmit={send} className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(q))}
              className="rounded-full border border-line bg-[var(--glass-soft)] px-3.5 py-1.5 text-[0.8rem] font-semibold"
            >
              +{q}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            step={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Coins (use -5 to remove)"
            aria-label={`Coins to send to ${user.email}`}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-[var(--glass-soft)] px-3 text-[0.9rem] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
          />
          <button type="submit" disabled={busy || !amount} className="btn btn-primary shrink-0 px-5">
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
        {note ? (
          <p
            role={note.ok ? "status" : "alert"}
            className="text-[0.8rem]"
            style={{ color: note.ok ? "var(--accent)" : "var(--danger)" }}
          >
            {note.text}
          </p>
        ) : null}
      </form>
    </li>
  );
}

export function AdminUsers() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);

  const loadGrants = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const { data } = await supabase.rpc("admin_recent_grants");
    setGrants(Array.isArray(data) ? (data as Grant[]) : []);
  }, []);

  useEffect(() => {
    void loadGrants();
  }, [loadGrants]);

  const search = useCallback(async (value: string) => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const q = value.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("admin_search_users", { p_query: q });
    setSearching(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setResults(Array.isArray(data) ? (data as UserRow[]) : []);
  }, []);

  // search as you type (after a short pause)
  useEffect(() => {
    const timer = window.setTimeout(() => void search(query), 350);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  return (
    <section aria-label="Find a user and send coins" className="space-y-3">
      <div className="panel p-4">
        <h2 className="text-[1rem] font-bold tracking-tight">Find a user · send coins 🪙</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search(query);
          }}
          className="mt-3"
        >
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email, e.g. john@gmail.com"
            aria-label="Search users by email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="min-h-11 w-full rounded-xl border border-line bg-[var(--glass-soft)] px-3 text-[0.9rem] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
          />
        </form>
        <p className="mt-2 text-[0.75rem] text-faint">Type at least 2 letters. Part of an email works too.</p>
      </div>

      {error ? (
        <p role="alert" className="text-[0.85rem]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
      {searching ? <p className="text-[0.85rem] text-dim">Searching…</p> : null}

      {results && results.length === 0 && !searching ? (
        <p className="text-[0.85rem] text-dim">No user found for “{query.trim()}”.</p>
      ) : null}

      {results && results.length > 0 ? (
        <ul className="space-y-3">
          {results.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onChanged={(coins) => {
                setResults((current) =>
                  current ? current.map((row) => (row.id === user.id ? { ...row, coins } : row)) : current,
                );
                void loadGrants();
              }}
            />
          ))}
        </ul>
      ) : null}

      {grants.length > 0 ? (
        <section className="panel-flat p-4">
          <h3 className="t-label">Recent coin changes</h3>
          <ul className="mt-3 space-y-1.5 text-[0.8rem]">
            {grants.map((grant, index) => (
              <li key={`${grant.created_at}-${index}`} className="flex flex-wrap justify-between gap-x-3">
                <span className="min-w-0 truncate">{grant.user_email ?? "(deleted user)"}</span>
                <span className="tabular-nums text-dim">
                  {grant.amount > 0 ? "+" : ""}
                  {grant.amount} · {new Date(grant.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
