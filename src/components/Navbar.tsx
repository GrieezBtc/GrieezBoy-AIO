"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/Toast";
import { Wordmark } from "@/components/Wordmark";

type NavItem = { href: string; label: string; glyph: string };

const NAV: NavItem[] = [
  { href: "/", label: "Downloader", glyph: "⌘" },
  { href: "/video-hub", label: "Video Hub", glyph: "▤" },
  { href: "/history", label: "History", glyph: "◷" },
  { href: "/about", label: "About", glyph: "ⓘ" },
];

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost h-10 min-h-[40px] px-3 text-[0.65rem]"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      <span aria-hidden>{theme === "dark" ? "◑" : "◐"}</span>
      <span className="hidden lg:inline">{theme === "dark" ? "DARK" : "LIGHT"}</span>
    </button>
  );
}

export function Navbar() {
  const pathname = usePathname() ?? "/";
  const { push } = useToast();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

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

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between gap-3 px-3 sm:h-16 sm:px-5 lg:px-8">
          <Wordmark />

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="relative flex h-10 items-center gap-2 border border-transparent px-3 text-[0.7rem] tracking-[0.16em] uppercase transition-colors"
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
                      <span aria-hidden className="text-[0.7rem] opacity-70">
                        {item.glyph}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            {installEvent || canShare ? (
              <button
                type="button"
                onClick={onInstallOrShare}
                className="btn btn-ghost hidden h-10 min-h-[40px] px-3 text-[0.65rem] sm:inline-flex"
              >
                <span aria-hidden>{installEvent ? "⤓" : "↗"}</span>
                {installEvent ? "INSTALL" : "SHARE"}
              </button>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* mobile bottom navigation */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-[color-mix(in_srgb,var(--bg)_94%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-[54px] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.58rem] tracking-[0.12em] uppercase transition-colors"
                  style={{ color: active ? "var(--accent)" : "var(--text-faint)" }}
                >
                  <span aria-hidden className="text-sm leading-none">
                    {item.glyph}
                  </span>
                  {item.label}
                  <span
                    aria-hidden
                    className="h-px w-5"
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
