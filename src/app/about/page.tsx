import type { Metadata } from "next";
import Link from "next/link";
import { PLATFORMS } from "@/services/aioDownloader/platforms";

export const metadata: Metadata = {
  title: "About",
  description:
    "How the GRIEEZBOY AIO engine is architected: one AIO endpoint, one normalizer, a separate video hub.",
};

const SECTIONS = [
  {
    title: "One engine, one contract",
    body: "Every supported platform is resolved through a single server-side AIO endpoint. The browser posts { url } to /api/download and receives a strictly normalized payload — never the raw upstream response.",
  },
  {
    title: "Normalization first",
    body: "A single adapter validates schemes, strips empty or non-http links, deduplicates URLs, converts durations and file sizes, preserves expiring links and sorts highest-quality video first. Nothing is invented: if the provider didn't return it, it isn't shown.",
  },
  {
    title: "Separate video hub",
    body: "The Video Hub is a distinct module with its own endpoint, adapter and data model. The two systems never share clients, types or responses.",
  },
  {
    title: "Keys stay on the server",
    body: "RapidAPI credentials are read from environment variables inside route handlers only. No secret is ever bundled into client JavaScript, and upstream errors are mapped to safe, human error codes.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-3 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">
      <header className="mb-8">
        <span className="t-label">module 04</span>
        <h1 className="mt-2 text-[clamp(1.6rem,1.1rem+2.2vw,2.6rem)] leading-none font-bold tracking-[-0.04em]">
          ABOUT THE ENGINE
        </h1>
        <p className="mt-3 max-w-2xl text-[0.85rem] leading-relaxed text-dim">
          GRIEEZBOY AIO is a single media console: paste a link, the engine
          detects the source and returns every download the provider exposes.
        </p>
      </header>

      <div className="grid gap-px border border-line bg-[var(--line)] sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="bg-[color-mix(in_srgb,var(--panel-solid)_72%,transparent)] p-4"
          >
            <h2 className="text-[0.9rem] font-bold tracking-tight">{section.title}</h2>
            <p className="mt-2 text-[0.76rem] leading-relaxed text-dim">{section.body}</p>
          </section>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="t-label">Pipeline</h2>
        <pre className="mt-2 overflow-x-auto border border-line bg-[color-mix(in_srgb,var(--bg-deep)_70%,transparent)] p-4 text-[0.7rem] leading-relaxed text-dim">
{`frontend  →  POST /api/download        →  RapidAPI AIO  →  normalizer  →  frontend
frontend  →  GET  /api/video-hub       →  VIDEO_HUB_ENDPOINT  →  normalizer  →  frontend
frontend  →  GET  /api/video-hub/resolve →  stream resolver     →  normalizer  →  player`}
        </pre>
      </section>

      <section className="mt-8">
        <h2 className="t-label">Supported sources</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLATFORMS.map((platform) => (
            <li key={platform.id} className="border border-line px-3 py-2">
              <span
                className="text-[0.58rem] font-bold tracking-[0.2em]"
                style={{ color: platform.accent }}
              >
                {platform.short}
              </span>
              <p className="mt-1 text-[0.74rem]">{platform.label}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/" className="btn btn-primary px-5">
          Open downloader
        </Link>
        <Link href="/video-hub" className="btn px-5">
          Open video hub
        </Link>
      </div>
    </div>
  );
}
