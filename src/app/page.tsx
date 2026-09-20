import Link from "next/link";
import { DownloaderConsole } from "@/components/DownloaderConsole";
import { PLATFORMS } from "@/services/aioDownloader/platforms";

const FLOW = [
  { step: "01", label: "Paste URL", detail: "any supported source" },
  { step: "02", label: "Auto-detect", detail: "platform + media type" },
  { step: "03", label: "Execute", detail: "single AIO endpoint" },
  { step: "04", label: "Download", detail: "every returned format" },
];

const CAPABILITIES = [
  {
    title: "One engine, eight sources",
    body: "A single normalized API path handles every platform. No per-site pages, no duplicated flows.",
    tag: "architecture",
  },
  {
    title: "Server-side keys only",
    body: "Credentials never reach the browser. Requests are proxied, validated and timeout-guarded.",
    tag: "security",
  },
  {
    title: "Nothing invented",
    body: "Only formats the upstream actually returned are shown — deduplicated and quality-sorted.",
    tag: "normalization",
  },
  {
    title: "Local activity only",
    body: "Your history lives in this browser. It is never uploaded, shared or profiled.",
    tag: "privacy",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] overflow-x-clip px-3 pt-6 pb-24 sm:px-6 sm:pt-10 sm:pb-10 lg:px-8">
      <section className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="border px-2 py-1 text-[0.55rem] font-bold tracking-[0.22em] uppercase"
            style={{ borderColor: "var(--accent-line)", color: "var(--accent)" }}
          >
            <span aria-hidden className="live-dot mr-1.5 inline-block">
              ●
            </span>
            engine online
          </span>
          <span className="t-label">v2 · unified pipeline</span>
        </div>

        <h1 className="display mt-4">
          GRIEEZBOY
          <span className="text-accent"> AIO</span>
        </h1>
        <p className="t-label mt-2 text-[0.7rem] tracking-[0.34em]">
          multi-source media engine
        </p>

        <p className="subdisplay mt-5 max-w-2xl text-dim text-balance">
          One console for{" "}
          <span className="text-ink">
            YouTube, TikTok, Instagram, Facebook, X, Pinterest, Threads and Snapchat
          </span>
          . Paste a link, the engine identifies the source and returns every
          format the provider exposes.
        </p>

        <ol className="mt-6 grid grid-cols-2 gap-px border border-line bg-[var(--line)] sm:grid-cols-4">
          {FLOW.map((item) => (
            <li
              key={item.step}
              className="bg-[color-mix(in_srgb,var(--panel-solid)_72%,transparent)] px-3 py-3"
            >
              <span className="t-label text-[0.5rem] text-accent">{item.step}</span>
              <p className="mt-1 text-[0.8rem] font-bold tracking-tight">{item.label}</p>
              <p className="t-label mt-0.5 text-[0.5rem] normal-case">{item.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8" aria-label="Download console">
        <DownloaderConsole />
      </section>

      <section className="mt-12 grid gap-px border border-line bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
        {CAPABILITIES.map((item) => (
          <article
            key={item.title}
            className="bg-[color-mix(in_srgb,var(--panel-solid)_72%,transparent)] p-4"
          >
            <span className="t-label text-[0.5rem] text-accent">{item.tag}</span>
            <h2 className="mt-2 text-[0.88rem] font-bold tracking-tight">{item.title}</h2>
            <p className="mt-2 text-[0.74rem] leading-relaxed text-dim">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-10 flex flex-col gap-4 border border-line bg-[color-mix(in_srgb,var(--panel-solid)_55%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[0.95rem] font-bold tracking-tight">
            Looking for something to watch?
          </h2>
          <p className="mt-1.5 max-w-xl text-[0.75rem] text-dim">
            The Video Hub runs on a completely separate feed endpoint — search,
            stream and grab clips without leaving the console.
          </p>
        </div>
        <Link href="/video-hub" className="btn btn-primary shrink-0 px-5">
          <span aria-hidden>▤</span> Open Video Hub
        </Link>
      </section>

      <section className="mt-8" aria-label="Supported platforms">
        <h2 className="t-label">Supported endpoints</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {PLATFORMS.map((platform) => (
            <li
              key={platform.id}
              className="border border-line bg-[color-mix(in_srgb,var(--panel-solid)_50%,transparent)] px-3 py-2.5"
            >
              <span
                className="text-[0.6rem] font-bold tracking-[0.2em]"
                style={{ color: platform.accent }}
              >
                {platform.short}
              </span>
              <p className="mt-1 text-[0.74rem]">{platform.label}</p>
              <p className="t-label mt-0.5 text-[0.48rem] normal-case">{platform.hint}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
