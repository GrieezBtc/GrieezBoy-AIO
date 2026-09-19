import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for the GRIEEZBOY AIO media engine.",
};

const TERMS = [
  ["Acceptable use", "Only download media you own or have explicit rights to use. Respect the terms of the source platform and applicable copyright law."],
  ["No warranty", "The engine depends on third-party providers. Availability, quality and formats can change or fail without notice."],
  ["Rate limits", "Automated or abusive traffic is throttled to keep the queue responsive for everyone."],
  ["Content responsibility", "GRIEEZBOY AIO does not host, store or re-encode media. Links resolve directly to the provider's servers."],
  ["Changes", "These terms may be updated as the service evolves. Continued use constitutes acceptance."],
];

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-[820px] px-3 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">
      <span className="t-label">legal</span>
      <h1 className="mt-2 text-[clamp(1.5rem,1.1rem+2vw,2.3rem)] leading-none font-bold tracking-[-0.04em]">
        TERMS
      </h1>
      <dl className="mt-6 grid gap-px border border-line bg-[var(--line)]">
        {TERMS.map(([title, body]) => (
          <div
            key={title}
            className="bg-[color-mix(in_srgb,var(--panel-solid)_72%,transparent)] p-4"
          >
            <dt className="text-[0.85rem] font-bold">{title}</dt>
            <dd className="mt-1.5 text-[0.76rem] leading-relaxed text-dim">{body}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
