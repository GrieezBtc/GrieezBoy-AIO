import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What GRIEEZBOY AIO stores (almost nothing) and where it stores it.",
};

const POINTS = [
  ["No accounts", "There is no sign-up, no profile and no identity attached to a request."],
  ["Local history", "Your activity log lives in this browser's localStorage. It is never transmitted and can be wiped from the Activity Log page."],
  ["Request handling", "Submitted links are forwarded server-side to the media provider only to resolve download options. Normalized results may be cached briefly to reduce upstream load."],
  ["No third-party trackers", "No analytics scripts, no advertising pixels, no fingerprinting."],
  ["Credentials", "API keys are read from server environment variables and never exposed to the browser."],
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-[820px] px-3 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">
      <span className="t-label">legal</span>
      <h1 className="mt-2 text-[clamp(1.5rem,1.1rem+2vw,2.3rem)] leading-none font-bold tracking-[-0.04em]">
        PRIVACY
      </h1>
      <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-[var(--line)] backdrop-blur-md">
        {POINTS.map(([title, body]) => (
          <div
            key={title}
            className="bg-[var(--glass-soft)] p-4"
          >
            <dt className="text-[0.85rem] font-bold">{title}</dt>
            <dd className="mt-1.5 text-[0.8rem] leading-relaxed text-dim">{body}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
