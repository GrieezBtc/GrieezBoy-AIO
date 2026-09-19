import type { Metadata } from "next";
import { HistoryView } from "@/components/HistoryView";

export const metadata: Metadata = {
  title: "Activity Log",
  description: "Locally stored downloader activity. Never transmitted.",
};

export default function HistoryPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">
      <header className="mb-6">
        <span className="t-label">module 03</span>
        <h1 className="mt-2 text-[clamp(1.6rem,1.1rem+2.2vw,2.6rem)] leading-none font-bold tracking-[-0.04em]">
          ACTIVITY LOG
        </h1>
        <p className="mt-3 max-w-2xl text-[0.85rem] leading-relaxed text-dim">
          The last 40 executions from this device. Stored in localStorage, never
          sent anywhere, wipeable at any time.
        </p>
      </header>
      <HistoryView />
    </div>
  );
}
