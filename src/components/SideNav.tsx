"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/Toast";
import { COIN_COST, WELCOME_COINS } from "@/lib/access";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const LINKS = [
  { href: "/", label: "Downloader", glyph: "⌘" },
  { href: "/video-hub", label: "Video Hub", glyph: "▤" },
  { href: "/history", label: "History", glyph: "◷" },
  { href: "/about", label: "About", glyph: "ⓘ" },
  { href: "/contact", label: "Report an issue", glyph: "⚑" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

const ROW =
  "flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-3 text-left text-[0.9rem] font-medium transition-colors hover:bg-[var(--glass-hover)]";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="t-label px-3">{title}</h2>
      <div className="mt-1.5 space-y-0.5">{children}</div>
    </section>
  );
}

export function SideNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname() ?? "/";
  const auth = useAuth();
  const { theme, toggle } = useTheme();
  const { push } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastPath = useRef(pathname);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  // the browser fires this once; keep it for the Install button
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // close after navigating
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const onInstallOrShare = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        push({ title: "Installed", body: "GRIEEZBOY AIO added to your device.", tone: "ok" });
      }
      setInstallEvent(null);
      return;
    }
    const nav: Navigator = navigator;
    if (typeof nav.share === "function") {
      try {
        await nav.share({
          title: "GRIEEZBOY AIO",
          text: "Multi-source media engine",
          url: window.location.origin,
        });
      } catch {
        /* user cancelled */
      }
      return;
    }
    try {
      await nav.clipboard.writeText(window.location.origin);
      push({ title: "Link copied", body: window.location.origin, tone: "ok" });
    } catch {
      push({ title: "Copy failed", body: "Clipboard unavailable in this browser.", tone: "error" });
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const email = auth.user?.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();
  const showAccount = auth.configured && auth.ready;

  return (
    <div className="fixed inset-0 z-[150]">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="drawer-in panel absolute inset-y-0 left-0 flex w-[min(86vw,340px)] flex-col overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        style={{ borderRadius: "0 28px 28px 0" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.95rem] font-bold tracking-tight">Menu</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-[var(--glass-soft)]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        {/* profile */}
        {showAccount ? (
          <div className="panel-flat mt-4 p-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold"
                style={{
                  background: "linear-gradient(145deg, var(--accent), var(--accent-2))",
                  color: "var(--on-accent)",
                }}
              >
                {auth.user ? initial : "👤"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.9rem] font-semibold">{auth.user ? email : "Guest"}</p>
                <p className="text-[0.78rem] text-dim">
                  {auth.status === "premium" ? "Premium member" : auth.user ? "Free member" : "Not signed in"}
                </p>
              </div>
            </div>

            {auth.user ? (
              <>
                <div
                  className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3"
                  style={{ background: "var(--accent-soft)" }}
                >
                  <div>
                    <p className="t-label">Balance</p>
                    <p className="text-2xl font-bold tabular-nums">🪙 {auth.coins.toLocaleString()}</p>
                  </div>
                  {auth.status === "premium" ? (
                    <span className="text-[0.78rem] font-semibold text-accent">Unlimited</span>
                  ) : null}
                </div>
                <p className="mt-2 text-[0.75rem] leading-relaxed text-faint">
                  {auth.status === "premium"
                    ? "Premium downloads don't spend coins."
                    : `${COIN_COST} coin per successful download. Failed lookups are free.`}
                </p>
                {auth.status !== "premium" ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      auth.openPrompt(auth.coins > 0 ? "upgrade" : "no_coins");
                    }}
                    className="btn btn-primary mt-3 w-full"
                  >
                    🪙 Get coins
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <p className="mt-3 text-[0.8rem] leading-relaxed text-dim">
                  Sign up free and get {WELCOME_COINS} 🪙 coins to unlock every platform.
                </p>
                <Link href="/login?mode=signup" onClick={onClose} className="btn btn-primary mt-3 w-full">
                  Sign up free
                </Link>
                <Link href="/login" onClick={onClose} className="btn mt-2 w-full">
                  Sign in
                </Link>
              </>
            )}
          </div>
        ) : null}

        <nav aria-label="Site">
          <Section title="Pages">
            {LINKS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={ROW}
                  style={active ? { color: "var(--accent)", background: "var(--accent-soft)" } : undefined}
                >
                  <span aria-hidden className="w-5 text-center opacity-80">
                    {item.glyph}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </Section>
        </nav>

        <Section title="Preferences">
          <button
            type="button"
            onClick={toggle}
            className={ROW}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <span aria-hidden className="w-5 text-center opacity-80">
              {theme === "dark" ? "◑" : "◐"}
            </span>
            Theme
            <span className="ml-auto text-[0.8rem] text-dim">{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          <button type="button" onClick={() => void onInstallOrShare()} className={ROW}>
            <span aria-hidden className="w-5 text-center opacity-80">
              {installEvent ? "⤓" : "↗"}
            </span>
            {installEvent ? "Install app" : canShare ? "Share this site" : "Copy site link"}
          </button>
        </Section>

        {auth.user ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              void auth.signOut();
            }}
            className="btn btn-ghost mt-6 w-full"
          >
            Sign out
          </button>
        ) : null}
      </aside>
    </div>
  );
}
