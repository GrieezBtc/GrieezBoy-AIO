"use client";

import { ERROR_TITLES } from "@/services/aioDownloader/errors";
import type { DownloadErrorCode } from "@/services/aioDownloader/types";

type Props = {
  code: DownloadErrorCode;
  message: string;
  retryable: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
};

const HINTS: Partial<Record<DownloadErrorCode, string>> = {
  INVALID_URL: "Check for typos, or paste the full link including https://",
  UNSUPPORTED_PLATFORM: "Try a link from one of the seven supported sources.",
  PRIVATE_CONTENT: "Private accounts and age-gated media cannot be resolved.",
  NO_MEDIA: "Text-only posts contain nothing to extract.",
  RATE_LIMITED: "The engine limits burst traffic to keep the queue fast.",
};

export function ErrorState({ code, message, retryable, onRetry, onDismiss }: Props) {
  return (
    <section
      role="alert"
      className="panel reveal relative overflow-hidden p-4 sm:p-5"
      style={{ borderColor: "color-mix(in srgb, var(--danger) 55%, transparent)" }}
    >
      <div
        aria-hidden
        className="hatch absolute inset-x-0 top-0 h-1"
        style={{ opacity: 0.6 }}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p
            className="text-[0.8rem] font-bold tracking-[0.18em] uppercase"
            style={{ color: "var(--danger)" }}
          >
            <span aria-hidden>[!] </span>
            {ERROR_TITLES[code]}
          </p>
          <p className="mt-2 max-w-xl text-[0.82rem] leading-relaxed text-dim">
            {message}
          </p>
          {HINTS[code] ? (
            <p className="mt-2 text-[0.7rem] text-faint">→ {HINTS[code]}</p>
          ) : null}
          <p className="t-label mt-3 text-[0.55rem]">
            code: {code} · retryable: {retryable ? "yes" : "no"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {retryable && onRetry ? (
            <button type="button" onClick={onRetry} className="btn px-4">
              <span aria-hidden>↻</span> Retry
            </button>
          ) : null}
          {onDismiss ? (
            <button type="button" onClick={onDismiss} className="btn btn-ghost px-4">
              Dismiss
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
