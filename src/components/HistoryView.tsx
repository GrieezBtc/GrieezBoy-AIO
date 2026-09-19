"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { relativeTime } from "@/lib/format";
import {
  clearHistory,
  HISTORY_EVENT,
  readHistory,
  removeHistory,
  type HistoryEntry,
} from "@/lib/history";
import { PLATFORM_MAP } from "@/services/aioDownloader/platforms";

export function HistoryView() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const { push } = useToast();
  const router = useRouter();

  useEffect(() => {
    const sync = () => setEntries(readHistory());
    sync();
    setMounted(true);
    window.addEventListener(HISTORY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(HISTORY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!mounted) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="panel-flat grid place-items-center gap-2 px-4 py-14 text-center">
        <p className="t-label">log empty</p>
        <p className="max-w-md text-[0.8rem] text-dim">
          Executed links appear here. Everything is stored in this browser only —
          nothing is uploaded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="t-label">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"} · local storage only
        </p>
        <button
          type="button"
          onClick={() => {
            clearHistory();
            push({ title: "History cleared", body: "Local activity log wiped.", tone: "ok" });
          }}
          className="btn px-4 text-[0.62rem]"
        >
          <span aria-hidden>⌫</span> Clear history
        </button>
      </div>

      <ul className="grid gap-2">
        {entries.map((entry) => {
          const platform = PLATFORM_MAP[entry.platform];
          return (
            <li
              key={entry.id}
              className="flex flex-col gap-3 border border-line bg-[color-mix(in_srgb,var(--panel-solid)_58%,transparent)] p-2.5 sm:flex-row sm:items-center"
            >
              {entry.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={entry.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-24 w-full shrink-0 border border-line object-cover sm:h-14 sm:w-24"
                />
              ) : (
                <span className="grid h-14 w-full shrink-0 place-items-center border border-line text-[0.6rem] text-faint sm:w-24">
                  {platform?.short ?? "—"}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8rem] font-bold">
                  {entry.title ?? entry.url}
                </p>
                <p className="mt-1 truncate text-[0.66rem] text-faint">{entry.url}</p>
                <p className="t-label mt-1 flex flex-wrap gap-x-2 text-[0.5rem] normal-case">
                  <span style={{ color: platform?.accent }}>{entry.platformLabel}</span>
                  <span>· {relativeTime(entry.timestamp)}</span>
                  <span
                    style={{
                      color: entry.status === "ready" ? "var(--accent)" : "var(--danger)",
                    }}
                  >
                    · {entry.status}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/?url=${encodeURIComponent(entry.url)}`)}
                  className="btn flex-1 px-3 text-[0.6rem] sm:flex-none"
                >
                  <span aria-hidden>↻</span> Retry
                </button>
                <button
                  type="button"
                  onClick={() => removeHistory(entry.id)}
                  className="btn btn-ghost px-3 text-[0.6rem]"
                  aria-label={`Remove ${entry.title ?? entry.url} from history`}
                >
                  <span aria-hidden>✕</span>
                  <span className="sr-only sm:not-sr-only">Remove</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
