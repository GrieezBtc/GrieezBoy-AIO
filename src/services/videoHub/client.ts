import { hubError, normalizeHubFeed } from "./normalizer";
import type { HubResponse } from "./types";

const YOUTUBE_ENDPOINT = "https://www.googleapis.com/youtube/v3";
const HUB_TIMEOUT_MS = 15_000;
const MAX_RESULTS = 24;

function getApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  return key || null;
}

async function requestJson(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      body: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HUB_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const url = new URL(`${YOUTUBE_ENDPOINT}/${path}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    url.searchParams.set("key", apiKey);

    const response = await fetch(url, {
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

function normalizeYouTubeItems(body: unknown): HubResponse {
  return normalizeHubFeed(body, {
    query: "",
    page: 0,
  });
}

export function isHubLive(): boolean {
  return Boolean(getApiKey());
}

export type HubFetchResult = {
  feed: HubResponse;
  nextPageToken?: string;
};

export async function fetchHubFeed(options: {
  query: string;
  page: number;
  pageToken?: string;
  signal?: AbortSignal;
}): Promise<HubFetchResult> {
  const query = options.query.trim().slice(0, 120);

  try {
    const params: Record<string, string> = {
      part: query ? "snippet" : "snippet,contentDetails,statistics",
      maxResults: String(MAX_RESULTS),
    };

    if (query) {
      params.type = "video";
      params.q = query;
      params.order = "relevance";

      if (options.pageToken) {
        params.pageToken = options.pageToken;
      }

      const result = await requestJson(
        "search",
        params,
        options.signal,
      );

      if (!result.ok) {
        if (result.status === 429) return { feed: hubError("RATE_LIMITED") };
        if (result.status === 404) return { feed: hubError("NOT_FOUND") };
        if (result.status === 408 || result.status === 504) {
          return { feed: hubError("TIMEOUT") };
        }
        if (result.status === 503) {
          return { feed: hubError("UPSTREAM_ERROR") };
        }

        return { feed: hubError("UPSTREAM_ERROR") };
      }

      const body = result.body as Record<string, unknown>;

      return {
        feed: normalizeYouTubeItems({
          ...body,
          _query: query,
          _page: options.page,
        }),
        nextPageToken:
          typeof body.nextPageToken === "string"
            ? body.nextPageToken
            : undefined,
      };
    }

    params.chart = "mostPopular";
    params.regionCode = "NG";

    const result = await requestJson(
      "videos",
      params,
      options.signal,
    );

    if (!result.ok) {
      if (result.status === 429) return { feed: hubError("RATE_LIMITED") };
      if (result.status === 404) return { feed: hubError("NOT_FOUND") };
      if (result.status === 408 || result.status === 504) {
        return { feed: hubError("TIMEOUT") };
      }
      if (result.status === 503) {
        return { feed: hubError("UPSTREAM_ERROR") };
      }

      return { feed: hubError("UPSTREAM_ERROR") };
    }

    const body = result.body as Record<string, unknown>;

    return {
      feed: normalizeYouTubeItems({
        ...body,
        _query: "",
        _page: options.page,
      }),
      nextPageToken:
        typeof body.nextPageToken === "string"
          ? body.nextPageToken
          : undefined,
    };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;

    if (name === "AbortError" || name === "TimeoutError") {
      return { feed: hubError("TIMEOUT") };
    }

    return { feed: hubError("NETWORK_ERROR") };
  }
}

export async function resolveHubStream(options: {
  url: string;
  signal?: AbortSignal;
}) {
  const sourceUrl = options.url.trim();

  try {
    const parsed = new URL(sourceUrl);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return hubError("BAD_QUERY");
    }
  } catch {
    return hubError("BAD_QUERY");
  }

  return {
    success: true as const,
    id: sourceUrl,
    playback: {
      url: sourceUrl,
      type: "unknown" as const,
    },
    downloadUrl: sourceUrl,
  };
}
