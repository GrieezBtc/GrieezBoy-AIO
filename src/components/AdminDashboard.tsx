"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminUsers } from "@/components/AdminUsers";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Row = { label: string; n: number };
type Day = { day: string; visits: number; visitors: number; downloads: number };
type Stats = {
  visits: number;
  visitors: number;
  downloads: number;
  failed: number;
  blocked: number;
  signups: number;
  total_users: number;
  premium_active: number;
  daily: Day[];
  top_pages: Row[];
  countries: Row[];
  devices: Row[];
  referrers: Row[];
  platforms: Row[];
  blocked_reasons: Row[];
};

const RANGES = [
  { days: 1, label: "24h" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel-flat p-3.5">
      <p className="t-label">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function List({ title, rows }: { title: string; rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="panel-flat p-4">
      <h2 className="t-label">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-[0.8rem] text-faint">No data yet</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.label} className="text-[0.8rem]">
              <div className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="tabular-nums text-dim">{row.n.toLocaleString()}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--glass-soft)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(row.n / max) * 100}%`,
                    background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminDashboard() {
  const auth = useAuth();
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("admin_stats", { p_days: days });
    if (rpcError) {
      setStats(null);
      setError(
        rpcError.message.includes("not allowed")
          ? "This account is not an admin."
          : rpcError.message,
      );
    } else {
      setStats(data as Stats);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    if (auth.ready && auth.user) void load();
  }, [auth.ready, auth.user, load]);

  if (!auth.configured) return <p className="text-dim">Accounts are not configured.</p>;
  if (!auth.ready) return <p className="text-dim">Loading…</p>;
  if (!auth.user) {
    return (
      <p className="text-dim">
        <Link href="/login" className="text-accent">
          Sign in
        </Link>{" "}
        with your admin account to see the stats.
      </p>
    );
  }

  const maxVisits = Math.max(1, ...(stats?.daily ?? []).map((d) => d.visits));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((range) => (
          <button
            key={range.days}
            type="button"
            onClick={() => setDays(range.days)}
            className={`btn h-10 min-h-[40px] px-4 text-[0.8rem] ${days === range.days ? "btn-primary" : ""}`}
          >
            {range.label}
          </button>
        ))}
        <button type="button" onClick={() => void load()} className="btn btn-ghost h-10 min-h-[40px] px-4 text-[0.8rem]">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p role="alert" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}

      {stats ? (
        <>
          <AdminUsers />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label="Page views" value={stats.visits} />
            <Card label="Unique visitors" value={stats.visitors} />
            <Card label="Downloads" value={stats.downloads} />
            <Card label="Failed lookups" value={stats.failed} />
            <Card label="Sign-ups" value={stats.signups} />
            <Card label="Total users" value={stats.total_users} />
            <Card label="Active premium" value={stats.premium_active} />
            <Card label="Hit a limit / lock" value={stats.blocked} />
          </div>

          <section className="panel-flat p-4">
            <h2 className="t-label">Per day (Nigerian time)</h2>
            {stats.daily.length === 0 ? (
              <p className="mt-3 text-[0.8rem] text-faint">No data yet</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {stats.daily.map((d) => (
                  <li key={d.day} className="text-[0.8rem]">
                    <div className="flex flex-wrap justify-between gap-x-3">
                      <span>{d.day}</span>
                      <span className="tabular-nums text-dim">
                        {d.visits} views · {d.visitors} visitors · {d.downloads} downloads
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--glass-soft)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(d.visits / maxVisits) * 100}%`,
                          background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <List title="Top pages" rows={stats.top_pages} />
            <List title="Downloads by platform" rows={stats.platforms} />
            <List title="Countries (visitors)" rows={stats.countries} />
            <List title="Devices (visitors)" rows={stats.devices} />
            <List title="Where visitors came from" rows={stats.referrers} />
            <List title="Why people were blocked" rows={stats.blocked_reasons} />
          </div>
        </>
      ) : null}
    </div>
  );
}
