"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { VideoCard, VideoCardSkeleton } from "@/components/hub/VideoCard";
import { VideoPlayer } from "@/components/hub/VideoPlayer";
import type { HubResponse, HubVideo } from "@/services/videoHub/types";

const SEARCH_DEBOUNCE_MS = 280;

type HubMode = "feed" | "search";

export function VideoHubView() {
  const { push } = useToast();

  const [mode, setMode] = useState<HubMode>("feed");
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

  const requestAbortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const requestedRef = useRef("");

  const enterSearchMode = useCallback(() => {
    if (mode === "search") return;

    requestAbortRef.current?.abort();
    loadingRef.current = false;
    requestedRef.current = "";

    setMode("search");
    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
  }, [mode]);

  const returnToFeed = useCallback(() => {
    requestAbortRef.current?.abort();
    loadingRef.current = false;
    requestedRef.current = "";

    setMode("feed");
    setInput("");
    setQuery("");
    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);
    setLoading(true);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = input.trim();

      if (nextQuery) {
        setQuery(nextQuery);
      } else if (mode === "search") {
        returnToFeed();
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [input, mode, returnToFeed]);

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

  const loadPage = useCallback(
    async (targetQuery: string, targetPage: number, initial = false) => {
      const cleanQuery = targetQuery.trim();

      if (mode === "search" && !cleanQuery) return;
      if (loadingRef.current) return;

      const key = `${mode}:${cleanQuery}:${targetPage}`;

      if (requestedRef.current === key) return;
      requestedRef.current = key;

      requestAbortRef.current?.abort();

      const controller = new AbortController();
      requestAbortRef.current = controller;
      loadingRef.current = true;

      if (initial || targetPage === 0) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          page: String(targetPage),
        });

        if (cleanQuery) {
          params.set("q", cleanQuery);
        }

        const response = await fetch(
          `/api/video-hub?${params.toString()}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as HubResponse;

        if (!payload.success) {
          throw new Error(payload.error.message);
        }

        setItems((current) => {
          if (targetPage === 0) {
            return payload.items;
          }

          const existing = new Set(current.map((item) => item.id));

          return [
            ...current,
            ...payload.items.filter(
              (item) => !existing.has(item.id),
            ),
          ];
        });

        setPage(targetPage);
        setHasMore(payload.hasMore);
        setError(null);
      } catch (caught) {
        if ((caught as { name?: string })?.name === "AbortError") {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Connection to the video service failed.",
        );

        setHasMore(false);

        if (targetPage === 0) {
          setItems([]);
        }
      } finally {
        loadingRef.current = false;

        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }

        requestedRef.current = "";
      }
    },
    [mode],
  );

  /*
   * Default YouTube popular feed.
   */
  useEffect(() => {
    if (mode !== "feed") return;

    if (items.length === 0 && !loadingRef.current) {
      void loadPage("", 0, true);
    }
  }, [mode, items.length, loadPage]);

  /*
   * Debounced YouTube search.
   */
  useEffect(() => {
    if (mode !== "search" || !query) return;

    requestAbortRef.current?.abort();
    loadingRef.current = false;
    requestedRef.current = "";

    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);

    void loadPage(query, 0, true);
  }, [mode, query, loadPage]);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
    };
  }, []);

  /*
   * Infinite loading.
   */
  useEffect(() => {
    const node = sentinelRef.current;

    if (!node || loading || loadingMore || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;

        const nextPage = page + 1;

        void loadPage(
          mode === "search" ? query : "",
          nextPage,
        );
      },
      { rootMargin: "700px 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [
    mode,
    query,
    page,
    hasMore,
    loading,
    loadingMore,
    loadPage,
  ]);

  const share = useCallback(
    async (video: HubVideo) => {
      const url = video.sourceUrl ?? window.location.href;

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: video.title,
            url,
          });
          return;
        } catch {
          /* cancelled */
        }
      }

      try {
        await navigator.clipboard.writeText(url);

        push({
          title: "Link copied",
          body: video.title,
          tone: "ok",
        });
      } catch {
        push({
          title: "Share failed",
          body: "Clipboard unavailable.",
          tone: "error",
        });
      }
    },
    [push],
  );

  /*
   * Download through the existing AIO downloader.
   *
   * YouTube's Data API does not provide downloadable media URLs.
   * The actual download resolver remains the existing AIO pipeline.
   */
  const download = useCallback(
    async (video: HubVideo) => {
      if (!video.sourceUrl) {
        push({
          title: "No source URL",
          body: "This video cannot be downloaded.",
          tone: "error",
        });
        return;
      }

      try {
        const response = await fetch("/api/download", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            url: video.sourceUrl,
          }),
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(
            payload?.error?.message ??
              "Unable to resolve the download.",
          );
        }

        const options = Array.isArray(payload.options)
          ? payload.options
          : [];

        const preferred =
          options.find(
            (option: { url?: string; quality?: string }) =>
              option.url &&
              typeof option.url === "string" &&
              option.quality?.toLowerCase().includes("high"),
          ) ??
          options.find(
            (option: { url?: string }) =>
              option.url &&
              typeof option.url === "string",
          );

        if (!preferred?.url) {
          throw new Error("No downloadable format was returned.");
        }

        const filename =
          `${video.title.replace(/[^\\w\\s.-]/g, "").trim().slice(0, 80) || "youtube-video"}.mp4`;

        const downloadUrl =
          `/api/media?url=${encodeURIComponent(preferred.url)}` +
          `&filename=${encodeURIComponent(filename)}`;

        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = filename;
        anchor.click();

        push({
          title: "Download started",
          body: video.title,
          tone: "ok",
        });
      } catch (caught) {
        push({
          title: "Download failed",
          body:
            caught instanceof Error
              ? caught.message
              : "Unable to resolve this video.",
          tone: "error",
        });
      }
    },
    [push],
  );

  const retry = useCallback(() => {
    void loadPage(
      mode === "search" ? query : "",
      page,
      page === 0,
    );
  }, [mode, query, page, loadPage]);

  return (
    <div className="space-y-5">
      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        className="panel flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
      >
        <label
          htmlFor="hub-search"
          className="t-label shrink-0 sm:pl-1"
        >
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
            onFocus={enterSearchMode}
            onChange={(event) => {
              if (mode !== "search") {
                enterSearchMode();
              }

              setInput(event.target.value);
            }}
            placeholder="Search YouTube videos…"
            autoComplete="off"
            className="min-h-[44px] w-full min-w-0 bg-transparent text-[0.85rem] outline-none placeholder:text-faint"
          />

          {mode === "search" ? (
            <button
              type="button"
              onClick={returnToFeed}
              className="grid h-9 w-9 shrink-0 place-items-center text-faint hover:text-ink"
              aria-label="Clear search and return to video feed"
            >
              <span aria-hidden>✕</span>
            </button>
          ) : null}
        </div>

        <p
          className="t-label shrink-0 text-[0.55rem] normal-case"
          aria-live="polite"
        >
          {loading
            ? mode === "feed"
              ? "loading popular videos…"
              : "searching YouTube…"
            : mode === "feed"
              ? `${items.length} videos`
              : `${items.length} results`}
        </p>
      </form>

      {offline ? (
        <p
          role="status"
          className="border px-3 py-2.5 text-[0.75rem]"
          style={{
            borderColor: "var(--amber)",
            color: "var(--amber)",
          }}
        >
          [~] Offline — waiting for your connection to return.
        </p>
      ) : null}

      {error && !loading ? (
        <div
          role="alert"
          className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor:
              "color-mix(in srgb, var(--danger) 55%, transparent)",
          }}
        >
          <div>
            <p
              className="text-[0.78rem] font-bold tracking-[0.18em] uppercase"
              style={{ color: "var(--danger)" }}
            >
              [!]{" "}
              {mode === "feed"
                ? "Feed unavailable"
                : "Search unavailable"}
            </p>

            <p className="mt-1.5 text-[0.76rem] text-dim">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={retry}
            className="btn px-4"
          >
            <span aria-hidden>↻</span> Retry
          </button>
        </div>
      ) : null}

      {mode === "search" &&
      query &&
      !loading &&
      !error &&
      items.length === 0 ? (
        <div className="panel-flat grid place-items-center gap-2 px-4 py-12 text-center">
          <p className="t-label">no results</p>

          <p className="max-w-md text-[0.8rem] text-dim">
            Nothing matched{" "}
            <span className="text-ink">“{query}”</span>.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {loading
          ? Array.from({
              length: mode === "feed" ? 10 : 8,
            }).map((_, index) => (
              <VideoCardSkeleton
                key={`skeleton-${index}`}
              />
            ))
          : items.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onWatch={setActive}
                onShare={(target) => void share(target)}
                onDownload={(target) => void download(target)}
              />
            ))}

        {loadingMore
          ? Array.from({
              length: mode === "feed" ? 5 : 4,
            }).map((_, index) => (
              <VideoCardSkeleton
                key={`more-skeleton-${index}`}
              />
            ))
          : null}
      </div>

      <div
        ref={sentinelRef}
        aria-hidden
        className="h-4"
      />

      {mode === "search" &&
      !hasMore &&
      items.length > 0 ? (
        <p className="t-label py-4 text-center">
          — end of search results —
        </p>
      ) : null}

      {active ? (
        <VideoPlayer
          video={active}
          onClose={() => setActive(null)}
          onDownload={() => void download(active)}
          onShare={(video) => void share(video)}
        />
      ) : null}
    </div>
  );
}
