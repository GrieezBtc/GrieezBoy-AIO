"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { SideNav } from "@/components/SideNav";
import { Wordmark } from "@/components/Wordmark";

type NavItem = { href: string; label: string; glyph: string };

// Report an issue, theme, install and share now live in the side menu.
const NAV: NavItem[] = [
  { href: "/", label: "Downloader", glyph: "⌘" },
  { href: "/video-hub", label: "Video Hub", glyph: "▤" },
  { href: "/history", label: "History", glyph: "◷" },
  { href: "/about", label: "About", glyph: "ⓘ" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function AccountArea({ onOpenMenu }: { onOpenMenu: () => void }) {
  const auth = useAuth();
  if (!auth.configured || !auth.ready) return null;
  if (auth.user) {
    return (
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-[var(--glass-soft)] px-3.5 text-[0.82rem] font-semibold tabular-nums"
        aria-label={auth.status === "premium" ? "Premium account, open menu" : `${auth.coins} coins, open menu`}
      >
        {auth.status === "premium" ? "👑 Premium" : `🪙 ${auth.coins.toLocaleString()}`}
      </button>
    );
  }
  return (
    <Link href="/login" className="btn btn-primary h-10 min-h-[40px] px-4 text-[0.78rem]">
      Sign in
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-[var(--panel)] shadow-[var(--glass-edge)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 w-full min-w-0 max-w-[1400px] items-center justify-between gap-2 px-3 sm:h-16 sm:px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={openMenu}
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-[var(--glass-soft)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <Wordmark />
          </div>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="rounded-full relative flex h-10 items-center gap-2 border border-transparent px-4 text-[0.82rem] font-medium transition-colors"
                      style={
                        active
                          ? {
                              color: "var(--accent)",
                              borderColor: "var(--accent-line)",
                              background: "var(--accent-soft)",
                            }
                          : { color: "var(--text-dim)" }
                      }
                    >
                      <span aria-hidden className="text-[0.8rem] opacity-70">
                        {item.glyph}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <AccountArea onOpenMenu={openMenu} />
          </div>
        </div>
      </header>

      <SideNav open={menuOpen} onClose={closeMenu} />

      {/* mobile bottom navigation */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-[100] w-full rounded-t-3xl border-t border-line bg-[var(--panel)] shadow-[var(--glass-edge)] pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-150 md:hidden"
      >
        <ul className="mx-auto grid w-full max-w-lg grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-[54px] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.72rem] font-medium transition-colors"
                  style={{ color: active ? "var(--accent)" : "var(--text-faint)" }}
                >
                  <span aria-hidden className="text-sm leading-none">
                    {item.glyph}
                  </span>
                  {item.label}
                  <span
                    aria-hidden
                    className="h-0.5 w-5 rounded-full"
                    style={{ background: active ? "var(--accent)" : "transparent" }}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
