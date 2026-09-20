"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadResult } from "@/components/DownloadResult";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState, type Stage } from "@/components/LoadingState";
import { PlatformSelector } from "@/components/PlatformSelector";
import { useToast } from "@/components/Toast";
import { UrlInput } from "@/components/UrlInput";
import { addHistory, readHistory, type HistoryEntry } from "@/lib/history";
import { relativeTime } from "@/lib/format";
import { detectPlatform, parseHttpUrl, PLATFORM_MAP } from "@/services/aioDownloader/platforms";
import type {
  AioResponse,
  NormalizedDownloadError,
  NormalizedDownloadResult,
  SupportedPlatform,
} from "@/services/aioDownloader/types";

const STATUS_IDLE = "engine idle · awaiting target";

export function DownloaderConsole() {
  const { push } = useToast();
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<SupportedPlatform | "auto">("auto");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<NormalizedDownloadResult | null>(null);
  const [failure, setFailure] = useState<NormalizedDownloadError["error"] | null>(null);
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const trimmed = url.trim();
  const detected = useMemo(
    () => (trimmed.length > 4 ? detectPlatform(trimmed) : null),
    [trimmed],
  );

  const validationMessage = useMemo(() => {
    if (!trimmed) return null;
    if (trimmed.length < 8) return null;
    if (!parseHttpUrl(trimmed)) return "That doesn't look like a valid link.";
    if (!detected) return "The URL doesn't appear to belong to a supported platform.";
    return null;
  }, [trimmed, detected]);

  useEffect(() => {
    setRecent(readHistory().slice(0, 3));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get("url");
    if (preset) setUrl(preset);
  }, []);

  const statusLine = useMemo(() => {
    if (stage === "analyzing") return "analyzing target…";
    if (stage === "processing") return "extracting available streams…";
    if (!trimmed) return STATUS_IDLE;
    if (detected) {
      return `platform detected: ${PLATFORM_MAP[detected].label.toUpperCase()} · ready to execute`;
    }
    return "parsing input…";
  }, [stage, trimmed, detected]);

  const execute = useCallback(
    async (rawUrl?: string, platformOverride?: SupportedPlatform | "auto") => {
      const target = (rawUrl ?? url).trim();
      const platformChoice = platformOverride ?? selected;

      if (!target) {
        push({ title: "No URL", body: "Paste a media link first.", tone: "error" });
        return;
      }
      const parsed = parseHttpUrl(target);
      if (!parsed) {
        setResult(null);
        setStage("failed");
        setFailure({
          code: "INVALID_URL",
          message: "The URL doesn't appear to belong to a supported platform.",
          retryable: false,
        });
        return;
      }
      const platform =
        platformChoice === "auto" ? detectPlatform(parsed.toString()) : platformChoice;
      if (!platform) {
        setResult(null);
        setStage("failed");
        setFailure({
          code: "UNSUPPORTED_PLATFORM",
          message:
            "That source isn't supported yet. Supported: YouTube, TikTok, Instagram, Facebook, X, Pinterest, Threads, Snapchat.",
          retryable: false,
        });
        return;
      }

      const requestKey = `${platform}|${parsed.toString()}`;
      if (inFlightRef.current === requestKey) return;
      inFlightRef.current = requestKey;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFailure(null);
      setResult(null);
      setStage("analyzing");
      const toProcessing = window.setTimeout(() => setStage("processing"), 520);

      try {
        const response = await fetch("/api/download", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: parsed.toString(), platform }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as AioResponse;
        window.clearTimeout(toProcessing);

        if (payload.success) {
          setResult(payload);
          setStage("ready");
          addHistory({
            url: parsed.toString(),
            platform: payload.source.platform,
            platformLabel: payload.source.platformLabel,
            title: payload.media.title,
            thumbnailUrl: payload.media.thumbnailUrl,
            status: "ready",
          });
          setRecent(readHistory().slice(0, 3));
          push({
            title: "Streams ready",
            body: `${payload.options.length} download option${payload.options.length === 1 ? "" : "s"} found.`,
            tone: "ok",
          });
          window.setTimeout(
            () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
            80,
          );
        } else {
          setFailure(payload.error);
          setStage("failed");
          addHistory({
            url: parsed.toString(),
            platform,
            platformLabel: PLATFORM_MAP[platform].label,
            status: "failed",
          });
          setRecent(readHistory().slice(0, 3));
          push({ title: "Execution failed", body: payload.error.message, tone: "error" });
        }
      } catch (error) {
        window.clearTimeout(toProcessing);
        if ((error as { name?: string })?.name === "AbortError") return;
        setStage("failed");
        setFailure({
          code: "NETWORK_ERROR",
          message: "Network connection to the media engine failed.",
          retryable: true,
        });
      } finally {
        inFlightRef.current = null;
      }
    },
    [url, selected, push],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const onPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        setUrl(text.trim());
        push({ title: "Pasted", body: "Clipboard content loaded.", tone: "info" });
      } else {
        push({ title: "Clipboard empty", tone: "info" });
      }
    } catch {
      push({
        title: "Paste blocked",
        body: "Your browser blocked clipboard access — paste manually.",
        tone: "error",
      });
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setUrl("");
    setResult(null);
    setFailure(null);
    setStage("idle");
    setSelected("auto");
  };

  return (
    <div className="space-y-5">
      <UrlInput
        value={url}
        onChange={setUrl}
        onSubmit={() => void execute()}
        onClear={() => {
          setUrl("");
          setFailure(null);
          setStage("idle");
        }}
        onPaste={() => void onPaste()}
        loading={stage === "analyzing" || stage === "processing"}
        detected={detected}
        validationMessage={validationMessage}
        statusLine={statusLine}
      />

      <PlatformSelector
        detected={detected}
        selected={selected}
        onSelect={setSelected}
        disabled={stage === "analyzing" || stage === "processing"}
      />

      <div ref={resultRef} className="scroll-mt-20">
        {(stage === "analyzing" || stage === "processing") && (
          <LoadingState stage={stage} />
        )}

        {stage === "failed" && failure ? (
          <ErrorState
            code={failure.code}
            message={failure.message}
            retryable={failure.retryable}
            onRetry={() => void execute()}
            onDismiss={() => {
              setFailure(null);
              setStage("idle");
            }}
          />
        ) : null}

        {stage === "ready" && result ? (
          <DownloadResult result={result} onReset={reset} />
        ) : null}

        {stage === "idle" && recent.length ? (
          <section
            aria-label="Recent activity"
            className="panel-flat min-w-0 w-full max-w-full overflow-hidden p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="t-label">Recent activity</h3>
              <Link
                href="/history"
                className="t-label text-accent transition-opacity hover:opacity-70"
              >
                view log →
              </Link>
            </div>
            <ul className="mt-3 grid min-w-0 w-full max-w-full gap-2 sm:grid-cols-3">
              {recent.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setUrl(entry.url);
                      void execute(entry.url, "auto");
                    }}
                    className="flex min-h-[56px] w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden border border-line bg-[color-mix(in_srgb,var(--panel-solid)_55%,transparent)] p-2 text-left transition-colors hover:border-[var(--accent-line)]"
                  >
                    {entry.thumbnailUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={entry.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-10 w-16 shrink-0 border border-line object-cover"
                      />
                    ) : (
                      <span className="grid h-10 w-16 shrink-0 place-items-center border border-line text-[0.55rem] text-faint">
                        {PLATFORM_MAP[entry.platform].short}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.72rem]">
                        {entry.title ?? entry.url}
                      </span>
                      <span className="t-label block text-[0.5rem]">
                        {entry.platformLabel} · {relativeTime(entry.timestamp)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
