"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/components/Toast";
import {
  downloadWithProgress,
  type DownloadProgress,
} from "@/lib/downloadWithProgress";
import { formatBytes } from "@/lib/format";

type Resolved = { url: string; expectedBytes?: number };

export type StartDownloadInput = {
  title: string;
  filename: string;
  /** A direct URL, or an async resolver (shown as "resolving…" while pending). */
  source: Resolved | (() => Promise<Resolved>);
};

type Status = "resolving" | "downloading" | "done" | "error" | "cancelled";

type Entry = {
  id: number;
  title: string;
  status: Status;
  progress?: DownloadProgress;
  finalBytes?: number;
  error?: string;
};

type Ctx = { startDownload: (input: StartDownloadInput) => void };

const DownloadContext = createContext<Ctx | null>(null);

function formatEta(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s left`;
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const { push } = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const counter = useRef(0);
  const controllers = useRef(new Map<number, AbortController>());

  const patch = useCallback((id: number, update: Partial<Entry>) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...update } : entry)),
    );
  }, []);

  const remove = useCallback((id: number) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const startDownload = useCallback(
    (input: StartDownloadInput) => {
      counter.current += 1;
      const id = counter.current;
      const controller = new AbortController();
      controllers.current.set(id, controller);

      setEntries((current) => [
        ...current.slice(-3),
        { id, title: input.title, status: "resolving" },
      ]);

      void (async () => {
        try {
          const resolved =
            typeof input.source === "function" ? await input.source() : input.source;
          if (controller.signal.aborted) return;

          patch(id, {
            status: "downloading",
            progress: {
              received: 0,
              total: resolved.expectedBytes,
              speedBps: 0,
            },
          });

          const bytes = await downloadWithProgress({
            url: resolved.url,
            filename: input.filename,
            expectedBytes: resolved.expectedBytes,
            signal: controller.signal,
            onProgress: (progress) => patch(id, { progress }),
          });

          patch(id, { status: "done", finalBytes: bytes });
          push({
            title: "Download complete",
            body: `${input.title}${bytes ? ` · ${formatBytes(bytes)} used` : ""}`,
            tone: "ok",
          });
          window.setTimeout(() => remove(id), 6000);
        } catch (error) {
          if ((error as { name?: string })?.name === "AbortError") {
            patch(id, { status: "cancelled" });
            window.setTimeout(() => remove(id), 1500);
            return;
          }
          patch(id, {
            status: "error",
            error: error instanceof Error ? error.message : "Download failed.",
          });
        } finally {
          controllers.current.delete(id);
        }
      })();
    },
    [patch, push, remove],
  );

  const value = useMemo(() => ({ startDownload }), [startDownload]);

  return (
    <DownloadContext.Provider value={value}>
      {children}
      {entries.length ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[91] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end"
        >
          {entries.map((entry) => (
            <DownloadCard key={entry.id} entry={entry} onClose={() => remove(entry.id)} />
          ))}
        </div>
      ) : null}
    </DownloadContext.Provider>
  );
}

function DownloadCard({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { status, progress } = entry;
  const percent = progress?.percent;
  const known = percent !== undefined;

  const color =
    status === "error"
      ? "var(--danger)"
      : status === "done"
        ? "var(--accent)"
        : "var(--accent-line)";

  let line: string;
  if (status === "resolving") {
    line = "Resolving download…";
  } else if (status === "error") {
    line = entry.error ?? "Download failed.";
  } else if (status === "cancelled") {
    line = "Cancelled";
  } else if (status === "done") {
    line = entry.finalBytes ? `Saved · ${formatBytes(entry.finalBytes)}` : "Saved";
  } else if (progress) {
    const got = formatBytes(progress.received) || "0 B";
    const parts = [
      progress.total ? `${got} of ${formatBytes(progress.total)}` : `${got} downloaded`,
      known ? `${Math.floor(percent)}%` : null,
      progress.speedBps > 0 ? `${formatBytes(progress.speedBps)}/s` : null,
      formatEta(progress.etaSeconds) || null,
    ];
    line = parts.filter(Boolean).join(" · ");
  } else {
    line = "Starting…";
  }

  const active = status === "resolving" || status === "downloading";

  return (
    <div
      role="status"
      className="panel pointer-events-auto w-full max-w-sm px-3.5 py-3"
      style={{ borderColor: color }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.72rem] font-bold tracking-[0.1em] uppercase">
            {entry.title}
          </p>
          <p className="mt-1 text-[0.68rem] tabular-nums text-dim">{line}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-m-1 shrink-0 p-1 text-faint transition-colors hover:text-ink"
          aria-label={active ? "Cancel download" : "Dismiss"}
        >
          <span aria-hidden>✕</span>
        </button>
      </div>

      {active || status === "done" ? (
        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden border border-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={status === "done" ? 100 : known ? Math.round(percent) : undefined}
        >
          <div
            className={`h-full bg-[var(--accent)] transition-[width] duration-150 ${
              active && !known ? "w-1/3 animate-pulse" : ""
            }`}
            style={
              status === "done"
                ? { width: "100%" }
                : known
                  ? { width: `${percent}%` }
                  : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}

export function useDownloads(): Ctx {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error("useDownloads must be used inside DownloadProvider");
  return ctx;
}
