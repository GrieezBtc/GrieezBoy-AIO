import { isSafeMediaUrl } from "@/services/aioDownloader/platforms";
import { mockHubResolve, mockHubUpstream } from "./mock";
import { hubError, normalizeHubFeed } from "./normalizer";
import type { HubResolved, HubResponse } from "./types";

const HUB_TIMEOUT_MS = 15_000;

const SEARCH_ENDPOINT =
  "https://apis.davidcyril.name.ng/xxx/xnxx";

const DOWNLOAD_ENDPOINT =
  "https://apis.davidcyril.name.ng/download/xnxx";

function readLiveMode(): boolean {
  return process.env.VIDEO_HUB_LIVE !== "false";
}

async function requestJson(
  input: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HUB_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(input, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();

    let body: unknown = text;

    try {
      body = JSON.parse(text);
    } catch {
      /* keep raw text */
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

function buildSearchUrl(query: string, page: number): string {
  const url = new URL(SEARCH_ENDPOINT);

  url.searchParams.set("q", query);

  if (page > 0) {
    url.searchParams.set("page", String(page + 1));
  }

  return url.toString();
}

export function isHubLive(): boolean {
  return readLiveMode();
}

export async function fetchHubFeed(options: {
  query: string;
  page: number;
  signal?: AbortSignal;
}): Promise<HubResponse> {
  const query = options.query.trim().slice(0, 120);
  const page = Number.isFinite(options.page)
    ? Math.max(0, Math.floor(options.page))
    : 0;

  if (!query) {
    return normalizeHubFeed(
      {
        creator: "David Cyril",
        success: true,
        data: {
          page: 1,
          totalResults: 0,
          totalPages: 0,
          results: [],
        },
      },
      { query, page },
    );
  }

  if (!readLiveMode()) {
    await new Promise((resolve) => setTimeout(resolve, 420));

    return normalizeHubFeed(mockHubUpstream(query, page), {
      query,
      page,
    });
  }

  try {
    const { ok, status, body } = await requestJson(
      buildSearchUrl(query, page),
      options.signal,
    );

    if (!ok) {
      if (status === 429) return hubError("RATE_LIMITED");
      if (status === 404) return hubError("NOT_FOUND");
      if (status === 408 || status === 504) return hubError("TIMEOUT");

      return hubError("UPSTREAM_ERROR");
    }

    return normalizeHubFeed(body, {
      query,
      page,
    });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;

    if (name === "AbortError" || name === "TimeoutError") {
      return hubError("TIMEOUT");
    }

    return hubError("NETWORK_ERROR");
  }
}

/**
 * Resolves an XNXX search-result URL through the download API.
 *
 * The search API gives us the source URL. That exact URL is sent to:
 * /download/xnxx?url=<source URL>
 */
export async function resolveHubStream(options: {
  url: string;
  signal?: AbortSignal;
}): Promise<HubResolved> {
  const sourceUrl = options.url.trim().slice(0, 2000);

  try {
    const parsed = new URL(sourceUrl);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return hubError("BAD_QUERY");
    }
  } catch {
    return hubError("BAD_QUERY");
  }

  if (!readLiveMode()) {
    await new Promise((resolve) => setTimeout(resolve, 220));

    return toResolved(mockHubResolve(sourceUrl), sourceUrl);
  }

  try {
    const url = new URL(DOWNLOAD_ENDPOINT);
    url.searchParams.set("url", sourceUrl);

    const { ok, status, body } = await requestJson(
      url.toString(),
      options.signal,
    );

    if (!ok) {
      if (status === 429) return hubError("RATE_LIMITED");
      if (status === 404) return hubError("NOT_FOUND");
      if (status === 408 || status === 504) return hubError("TIMEOUT");

      return hubError("UPSTREAM_ERROR");
    }

    return toResolved(body, sourceUrl);
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;

    if (name === "AbortError" || name === "TimeoutError") {
      return hubError("TIMEOUT");
    }

    return hubError("NETWORK_ERROR");
  }
}

function toResolved(raw: unknown, id: string): HubResolved {
  if (typeof raw !== "object" || raw === null) {
    return hubError("MALFORMED_RESPONSE");
  }

  const root = raw as Record<string, unknown>;
  const result =
    typeof root.result === "object" && root.result !== null
      ? (root.result as Record<string, unknown>)
      : undefined;

  if (root.status === false || !result) {
    return hubError("MALFORMED_RESPONSE");
  }

  const download =
    typeof result.download === "object" && result.download !== null
      ? (result.download as Record<string, unknown>)
      : undefined;

  const candidates = [
    download?.high_quality,
    download?.low_quality,
  ];

  const playbackUrl = candidates.find((value) =>
    isSafeMediaUrl(value),
  );

  if (!playbackUrl || typeof playbackUrl !== "string") {
    return hubError("NOT_FOUND");
  }

  const url = playbackUrl.trim();

  return {
    success: true,
    id,
    playback: {
      url,
      type: "mp4",
    },
    downloadUrl: url,
  };
}
