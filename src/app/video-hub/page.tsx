import type { Metadata } from "next";
import { VideoHubView } from "@/components/hub/VideoHubView";

export const metadata: Metadata = {
  title: "Video Hub",
  description:
    "Search, stream and download from the GRIEEZBOY video index — a dedicated feed running on its own endpoint.",
};

export default function VideoHubPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="border px-2 py-1 text-[0.55rem] font-bold tracking-[0.22em] uppercase"
            style={{ borderColor: "var(--violet)", color: "var(--violet)" }}
          >
            module 02
          </span>
          <span className="t-label">independent feed endpoint</span>
        </div>
        <h1 className="mt-3 text-[clamp(1.6rem,1.1rem+2.2vw,2.6rem)] leading-none font-bold tracking-[-0.04em]">
          VIDEO HUB
        </h1>
        <p className="mt-3 max-w-2xl text-[0.85rem] leading-relaxed text-dim">
          A separate index with its own adapter and data model — never routed
          through the AIO downloader. Stream directly, grab the file, or share
          the entry.
        </p>
      </header>

      <VideoHubView />
    </div>
  );
}
