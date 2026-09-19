"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { VideoCard, VideoCardSkeleton } from "@/components/hub/VideoCard";
import { VideoPlayer } from "@/components/hub/VideoPlayer";
import type { HubResponse, HubVideo } from "@/services/videoHub/types";

const PAGE_DEBOUNCE_MS = 380;

export function VideoHubView() {
  const { push } = useToast();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<HubVideo[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [active, setActive] = useState<HubVideo | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<HubVideo | null>(null);
  const [generatedLoading, setGeneratedLoading] = useState(true);
  const [generatedError, setGeneratedError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const generatedAbortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestedRef = useRef<string>("");

  /* debounce search input */
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), PAGE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const load = useCallback(
    async (targetQuery: string, targetPage: number) => {
      const key = `${targetQuery}::${targetPage}`;
      if (requestedRef.current === key) return;
      requestedRef.current = key;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (targetPage === 0) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await fetch(
          `/api/video-hub?q=${encodeURIComponent(targetQuery)}&page=${targetPage}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as HubResponse;
        if (payload.success) {
          setItems((current) =>
            targetPage === 0
              ? payload.items
              : [
                  ...current,
                  ...payload.items.filter(
                    (item) => !current.some((existing) => existing.id === item.id),
                  ),
                ],
          );
          setHasMore(payload.hasMore);
          setPage(targetPage);
          setError(null);
        } else {
          setError(payload.error.message);
          if (targetPage === 0) setItems([]);
        }
      } catch (caught) {
        if ((caught as { name?: string })?.name === "AbortError") return;
        setError("Connection to the hub failed. Check your network and retry.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        requestedRef.current = "";
      }
    },
    [],
  );

  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    void load(query, 0);
  }, [query, load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadGeneratedVideo = useCallback(async () => {
    generatedAbortRef.current?.abort();

    const controller = new AbortController();
    generatedAbortRef.current = controller;

    setGeneratedLoading(true);
    setGeneratedError(null);

    try {
      const response = await fetch("/api/video-hub/stellaplus", {
        signal: controller.signal,
        cache: "no-store",
      });

      const payload = (await response.json()) as
        | {
            success: true;
            video: {
              title: string;
              thumbnail: string;
              playback: {
                url: string;
                type: "mp4";
              };
              downloadUrl: string;
              sourceUrl: string;
            };
          }
        | {
            success: false;
            error?: {
              message?: string;
            };
          };

      if (!response.ok || !payload.success) {
        throw new Error(
          !payload.success
            ? payload.error?.message ?? "Unable to load a generated video."
            : "Unable to load a generated video.",
        );
      }

      setGeneratedVideo({
        id: `stellaplus-${Date.now()}`,
        title: payload.video.title,
        thumbnailUrl: payload.video.thumbnail,
        sourceUrl: payload.video.sourceUrl,
        tags: ["stellaplus"],
        playback: {
          url: payload.video.playback.url,
          type: "mp4",
          needsResolve: false,
        },
        downloadUrl: payload.video.downloadUrl,
      });
    } catch (caught) {
      if ((caught as { name?: string })?.name === "AbortError") return;

      setGeneratedError(
        caught instanceof Error
          ? caught.message
          : "Unable to load a generated video.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setGeneratedLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadGeneratedVideo();

    return () => generatedAbortRef.current?.abort();
  }, [loadGeneratedVideo]);

  /* infinite loading */
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loading || loadingMore || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load(query, page + 1);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [load, query, page, hasMore, loading, loadingMore]);

  const share = useCallback(
    async (video: HubVideo) => {
      const url = video.sourceUrl ?? video.playback.url ?? window.location.href;
      const nav: Navigator = navigator;
      if (typeof nav.share === "function") {
        try {
          await nav.share({ title: video.title, url });
          return;
        } catch {
          /* cancelled */
        }
      }
      try {
        await nav.clipboard.writeText(url);
        push({ title: "Link copied", body: video.title, tone: "ok" });
      } catch {
        push({ title: "Share failed", body: "Clipboard unavailable.", tone: "error" });
      }
    },
    [push],
  );

  const download = useCallback(
    (video: HubVideo) => {
      const url = video.downloadUrl ?? (video.playback.type === "mp4" ? video.playback.url : undefined);
      if (!url) {
        push({
          title: "No direct file",
          body: "This entry is stream-only — open the player to watch it.",
          tone: "info",
        });
        return;
      }
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "";
      anchor.target = "_blank";
      anchor.rel = "noreferrer noopener";
      anchor.click();
      push({ title: "Download started", body: video.title, tone: "ok" });
    },
    [push],
  );

  return (
    <div className="space-y-5">
      <section className="panel p-3 sm:p-4" aria-labelledby="generated-video-title">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="t-label">StellaPlus</p>
            <h2 id="generated-video-title" className="mt-1 text-sm font-bold tracking-[0.08em]">
              Generated video
            </h2>
          </div>

          <button
            type="button"
            onClick={() => void loadGeneratedVideo()}
            disabled={generatedLoading}
            className="btn self-start px-4 sm:self-auto"
          >
            <span aria-hidden>↻</span>
            {generatedLoading ? "Loading…" : "New video"}
          </button>
        </div>

        {generatedError ? (
          <div
            role="alert"
            className="flex flex-col gap-3 border p-3 sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor:
                "color-mix(in srgb, var(--danger) 55%, transparent)",
            }}
          >
            <p className="text-[0.76rem] text-dim">{generatedError}</p>
            <button
              type="button"
              onClick={() => void loadGeneratedVideo()}
              className="btn px-4"
            >
              Retry
            </button>
          </div>
        ) : generatedLoading ? (
          <div className="grid grid-cols-1">
            <VideoCardSkeleton />
          </div>
        ) : generatedVideo ? (
          <div className="max-w-3xl">
            <VideoCard
              video={generatedVideo}
              onWatch={setActive}
              onShare={(target) => void share(target)}
              onDownload={download}
            />
          </div>
        ) : null}
      </section>

      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        className="panel flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
      >
        <label htmlFor="hub-search" className="t-label shrink-0 sm:pl-1">
          <span aria-hidden className="mr-2 text-accent">
            /
          </span>
          Search hub
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2 border border-line bg-[color-mix(in_srgb,var(--bg-deep)_65%,transparent)] px-2">
          <input
            id="hub-search"
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="query the index… (try: synth, archive, empty)"
            autoComplete="off"
            className="min-h-[44px] w-full min-w-0 bg-transparent text-[0.85rem] outline-none placeholder:text-faint"
          />
          {input ? (
            <button
              type="button"
              onClick={() => setInput("")}
              className="grid h-9 w-9 shrink-0 place-items-center text-faint hover:text-ink"
              aria-label="Clear search"
            >
              <span aria-hidden>✕</span>
            </button>
          ) : null}
        </div>
        <p className="t-label shrink-0 text-[0.55rem] normal-case" aria-live="polite">
          {loading ? "querying…" : `${items.length} entries`}
        </p>
      </form>

      {offline ? (
        <p
          role="status"
          className="border px-3 py-2.5 text-[0.75rem]"
          style={{ borderColor: "var(--amber)", color: "var(--amber)" }}
        >
          [~] Offline — showing what is already loaded. The feed resumes when your
          connection returns.
        </p>
      ) : null}

      {error && !loading ? (
        <div
          role="alert"
          className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "color-mix(in srgb, var(--danger) 55%, transparent)" }}
        >
          <div>
            <p
              className="text-[0.78rem] font-bold tracking-[0.18em] uppercase"
              style={{ color: "var(--danger)" }}
            >
              [!] Hub unavailable
            </p>
            <p className="mt-1.5 text-[0.76rem] text-dim">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void load(query, 0)}
            className="btn px-4"
          >
            <span aria-hidden>↻</span> Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {loading
          ? Array.from({ length: 8 }).map((_, index) => (
              <VideoCardSkeleton key={`skeleton-${index}`} />
            ))
          : items.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onWatch={setActive}
                onShare={(target) => void share(target)}
                onDownload={download}
              />
            ))}
        {loadingMore
          ? Array.from({ length: 4 }).map((_, index) => (
              <VideoCardSkeleton key={`more-skeleton-${index}`} />
            ))
          : null}
      </div>

      {!loading && !error && items.length === 0 ? (
        <div className="panel-flat grid place-items-center gap-2 px-4 py-12 text-center">
          <p className="t-label">no entries</p>
          <p className="max-w-md text-[0.8rem] text-dim">
            Nothing matched <span className="text-ink">“{query}”</span>. Try a
            broader term or clear the search field.
          </p>
          <button type="button" onClick={() => setInput("")} className="btn mt-2 px-4">
            Reset query
          </button>
        </div>
      ) : null}

      <div ref={sentinelRef} aria-hidden className="h-4" />

      {!hasMore && items.length > 0 ? (
        <p className="t-label py-4 text-center">— end of index —</p>
      ) : null}

      {active ? (
        <VideoPlayer
          video={active}
          onClose={() => setActive(null)}
          onDownload={() =>
            push({ title: "Download started", body: active.title, tone: "ok" })
          }
          onShare={(video) => void share(video)}
        />
      ) : null}
    </div>
  );
}
