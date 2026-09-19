"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { VideoCard, VideoCardSkeleton } from "@/components/hub/VideoCard";
import { VideoPlayer } from "@/components/hub/VideoPlayer";
import type { HubResponse, HubVideo } from "@/services/videoHub/types";

const SEARCH_DEBOUNCE_MS = 280;

type HubMode = "feed" | "search";

type StellaPlusPayload =
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

  const feedAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const feedLoadingRef = useRef(false);
  const feedSeenRef = useRef(new Set<string>());

  const searchLoadingRef = useRef(false);
  const searchRequestedRef = useRef<string>("");

  /*
   * Search mode begins immediately when the user focuses/types.
   * This wipes the StellaPlus feed before the debounced API request.
   */
  const enterSearchMode = useCallback(() => {
    if (mode === "search") return;

    feedAbortRef.current?.abort();
    feedLoadingRef.current = false;

    setMode("search");
    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
  }, [mode]);

  /*
   * Clearing the search returns the hub to its default StellaPlus feed.
   */
  const returnToFeed = useCallback(() => {
    searchAbortRef.current?.abort();
    searchLoadingRef.current = false;
    searchRequestedRef.current = "";

    setMode("feed");
    setInput("");
    setQuery("");
    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);
    setLoading(true);
    setLoadingMore(false);

    feedSeenRef.current.clear();
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

  /*
   * StellaPlus feed.
   *
   * Each request returns one generated video, so there is no page parameter.
   * We keep requesting as the user approaches the bottom and deduplicate by
   * source/playback URL.
   */
  const loadStellaPlus = useCallback(async (initial = false) => {
    if (mode !== "feed" || feedLoadingRef.current) return;

    feedLoadingRef.current = true;

    const controller = new AbortController();
    feedAbortRef.current = controller;

    if (initial) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await fetch("/api/video-hub/stellaplus", {
        signal: controller.signal,
        cache: "no-store",
      });

      const payload = (await response.json()) as StellaPlusPayload;

      if (!response.ok || !payload.success) {
        throw new Error(
          !payload.success
            ? payload.error?.message ?? "Unable to load the video feed."
            : "Unable to load the video feed.",
        );
      }

      const video: HubVideo = {
        id: `stellaplus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
      };

      const identity = video.downloadUrl ?? video.sourceUrl ?? video.id;

      if (!feedSeenRef.current.has(identity)) {
        feedSeenRef.current.add(identity);
        setItems((current) => [...current, video]);
      }
    } catch (caught) {
      if ((caught as { name?: string })?.name === "AbortError") return;

      setError(
        caught instanceof Error
          ? caught.message
          : "Connection to the video feed failed.",
      );
    } finally {
      feedLoadingRef.current = false;

      if (!controller.signal.aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [mode]);

  /*
   * Start the StellaPlus feed when the Video Hub opens.
   */
  useEffect(() => {
    if (mode !== "feed") return;

    if (items.length === 0) {
      void loadStellaPlus(true);
    }
  }, [mode, items.length, loadStellaPlus]);

  /*
   * Search API.
   *
   * Search is intentionally resolved lazily. The search endpoint only supplies
   * metadata/source URLs; Watch invokes the resolver through VideoPlayer.
   */
  const loadSearch = useCallback(
    async (targetQuery: string, targetPage: number) => {
      if (mode !== "search" || !targetQuery.trim()) return;
      if (searchLoadingRef.current) return;

      const key = `${targetQuery}::${targetPage}`;

      if (searchRequestedRef.current === key) return;
      searchRequestedRef.current = key;

      searchAbortRef.current?.abort();

      const controller = new AbortController();
      searchAbortRef.current = controller;
      searchLoadingRef.current = true;

      if (targetPage === 0) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await fetch(
          `/api/video-hub?q=${encodeURIComponent(targetQuery)}&page=${targetPage}`,
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
          if (targetPage === 0) return payload.items;

          const existing = new Set(current.map((item) => item.id));

          return [
            ...current,
            ...payload.items.filter((item) => !existing.has(item.id)),
          ];
        });

        setPage(targetPage);
        setHasMore(payload.hasMore);
        setError(null);
      } catch (caught) {
        if ((caught as { name?: string })?.name === "AbortError") return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Connection to the search service failed.",
        );

        if (targetPage === 0) {
          setItems([]);
        }
      } finally {
        searchLoadingRef.current = false;

        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }

        searchRequestedRef.current = "";
      }
    },
    [mode],
  );

  /*
   * A debounced query starts a fresh search and replaces whatever was there.
   */
  useEffect(() => {
    if (mode !== "search" || !query) return;

    searchAbortRef.current?.abort();
    searchLoadingRef.current = false;
    searchRequestedRef.current = "";

    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);

    void loadSearch(query, 0);
  }, [mode, query, loadSearch]);

  useEffect(() => {
    return () => {
      feedAbortRef.current?.abort();
      searchAbortRef.current?.abort();
    };
  }, []);

  /*
   * Infinite loading:
   *
   * Feed mode:
   *   request another StellaPlus video.
   *
   * Search mode:
   *   request the next search page.
   */
  useEffect(() => {
    const node = sentinelRef.current;

    if (!node || loading || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;

        if (mode === "feed") {
          void loadStellaPlus(false);
        } else if (query) {
          void loadSearch(query, page + 1);
        }
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
    loadStellaPlus,
    loadSearch,
  ]);

  const share = useCallback(
    async (video: HubVideo) => {
      const url =
        video.sourceUrl ?? video.playback.url ?? window.location.href;

      const nav: Navigator = navigator;

      if (typeof nav.share === "function") {
        try {
          await nav.share({
            title: video.title,
            url,
          });
          return;
        } catch {
          /* cancelled */
        }
      }

      try {
        await nav.clipboard.writeText(url);
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

  const download = useCallback(
    (video: HubVideo) => {
      const url =
        video.downloadUrl ??
        (video.playback.type === "mp4"
          ? video.playback.url
          : undefined);

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

      push({
        title: "Download started",
        body: video.title,
        tone: "ok",
      });
    },
    [push],
  );

  const retry = useCallback(() => {
    if (mode === "feed") {
      void loadStellaPlus(items.length === 0);
    } else if (query) {
      void loadSearch(query, page);
    }
  }, [mode, items.length, query, page, loadStellaPlus, loadSearch]);

  return (
    <div className="space-y-5">
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
            onFocus={enterSearchMode}
            onChange={(event) => {
              if (mode !== "search") enterSearchMode();
              setInput(event.target.value);
            }}
            placeholder="Search videos…"
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
              ? "loading feed…"
              : "searching…"
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
              [!] {mode === "feed" ? "Feed unavailable" : "Search unavailable"}
            </p>
            <p className="mt-1.5 text-[0.76rem] text-dim">{error}</p>
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

      {mode === "search" && query && !loading && !error && items.length === 0 ? (
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
                onDownload={download}
              />
            ))}

        {loadingMore
          ? Array.from({ length: mode === "feed" ? 5 : 4 }).map(
              (_, index) => (
                <VideoCardSkeleton
                  key={`more-skeleton-${index}`}
                />
              ),
            )
          : null}
      </div>

      <div
        ref={sentinelRef}
        aria-hidden
        className="h-4"
      />

      {mode === "search" && !hasMore && items.length > 0 ? (
        <p className="t-label py-4 text-center">
          — end of search results —
        </p>
      ) : null}

      {active ? (
        <VideoPlayer
          video={active}
          onClose={() => setActive(null)}
          onDownload={() =>
            push({
              title: "Download started",
              body: active.title,
              tone: "ok",
            })
          }
          onShare={(video) => void share(video)}
        />
      ) : null}
    </div>
  );
}
