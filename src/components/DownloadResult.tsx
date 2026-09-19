"use client";

import { DownloadOptions } from "@/components/DownloadOptions";
import { MediaPreview } from "@/components/MediaPreview";
import { StagePipeline } from "@/components/LoadingState";
import type { NormalizedDownloadResult } from "@/services/aioDownloader/types";

export function DownloadResult({
  result,
  onReset,
}: {
  result: NormalizedDownloadResult;
  onReset: () => void;
}) {
  return (
    <section
      aria-label="Download result"
      className="panel reveal relative overflow-hidden"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <StagePipeline stage="ready" />
        <div className="flex items-center gap-2">
          <span
            className="border px-2 py-1 text-[0.58rem] font-bold tracking-[0.18em] uppercase"
            style={{ borderColor: "var(--accent-line)", color: "var(--accent)" }}
          >
            status: ready
          </span>
          <button
            type="button"
            onClick={onReset}
            className="btn btn-ghost h-9 min-h-[40px] px-3 text-[0.6rem]"
          >
            New query
          </button>
        </div>
      </header>

      <div className="space-y-6 p-4 sm:p-5">
        <MediaPreview result={result} />
        <DownloadOptions options={result.options} title={result.media.title} />

        <details className="border border-line bg-[color-mix(in_srgb,var(--panel-solid)_50%,transparent)]">
          <summary className="t-label cursor-pointer list-none px-3 py-2.5 select-none">
            ▸ Technical metadata
          </summary>
          <dl className="grid gap-px border-t border-line bg-[var(--line)] sm:grid-cols-2">
            {[
              ["source url", result.source.url],
              ["platform id", result.source.platform],
              ["media id", result.media.id ?? "—"],
              ["media kind", result.media.kind],
              [
                "duration (s)",
                result.media.durationSeconds ? String(result.media.durationSeconds) : "—",
              ],
              ["options returned", String(result.options.length)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="bg-[color-mix(in_srgb,var(--panel-solid)_80%,transparent)] px-3 py-2"
              >
                <dt className="t-label text-[0.5rem]">{label}</dt>
                <dd className="mt-1 truncate text-[0.7rem] text-dim">{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </section>
  );
}
