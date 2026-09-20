import Link from "next/link";
import { PLATFORMS } from "@/services/aioDownloader/platforms";
import { LogoGlyph } from "@/components/Wordmark";

const SOCIALS = [
  { label: "WhatsApp", href: "https://wa.me/2349023326317", glyph: "WA" },
  { label: "X", href: "https://x.com/grieezboy01", glyph: "X" },
  { label: "Telegram", href: "https://t.me/grieezboy001", glyph: "TG" },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-[color-mix(in_srgb,var(--bg-deep)_70%,transparent)]">
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-8 pb-28 sm:px-6 md:pb-10 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoGlyph size={28} />
              <span className="text-[0.9rem] font-bold tracking-[-0.03em]">
                GRIEEZBOY <span className="text-accent">AIO</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-[0.72rem] leading-relaxed text-dim">
              One engine, eight sources. Paste a link, execute, download. No
              accounts, no tracking, no clutter.
            </p>
          </div>

          <div>
            <h2 className="t-label">Modules</h2>
            <ul className="mt-3 space-y-2 text-[0.75rem]">
              <li>
                <Link href="/" className="text-dim transition-colors hover:text-accent">
                  Downloader
                </Link>
              </li>
              <li>
                <Link href="/video-hub" className="text-dim transition-colors hover:text-accent">
                  Video Hub
                </Link>
              </li>
              <li>
                <Link href="/history" className="text-dim transition-colors hover:text-accent">
                  Activity log
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-dim transition-colors hover:text-accent">
                  About the engine
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="t-label">Supported sources</h2>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {PLATFORMS.map((platform) => (
                <li
                  key={platform.id}
                  className="border border-line px-2 py-1 text-[0.62rem] tracking-[0.1em] text-dim uppercase"
                >
                  {platform.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="t-label">Legal &amp; contact</h2>
            <ul className="mt-3 space-y-2 text-[0.75rem]">
              <li>
                <Link href="/privacy" className="text-dim transition-colors hover:text-accent">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-dim transition-colors hover:text-accent">
                  Terms
                </Link>
              </li>
            </ul>
            <ul className="mt-4 flex gap-2">
              {SOCIALS.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="grid h-10 w-10 place-items-center border border-line text-[0.62rem] tracking-[0.1em] text-dim transition-colors hover:border-[var(--accent-line)] hover:text-accent"
                  >
                    <span aria-hidden>{social.glyph}</span>
                    <span className="sr-only">{social.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-5 text-[0.65rem] tracking-[0.1em] text-faint uppercase sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} GRIEEZBOY AIO · All rights reserved</p>
          <p>
            Fast downloads, simple tools. Respect the creators and content behind every link.
          </p>
        </div>
      </div>
    </footer>
  );
}
