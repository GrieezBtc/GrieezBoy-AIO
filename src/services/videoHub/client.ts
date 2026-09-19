import { isSafeMediaUrl } from "@/services/aioDownloader/platforms";
import { mockHubResolve, mockHubUpstream } from "./mock";
import { hubError, normalizeHubFeed } from "./normalizer";
import type { HubResolved, HubResponse } from "./types";

const HUB_TIMEOUT_MS = 15_000;

function readEndpoint(): string | null {
  const endpoint = process.env.VIDEO_HUB_ENDPOINT?.trim();
  return endpoint ? endpoint : null;
}

export function isHubLive(): boolean {
  return readEndpoint() !== null;
}

/**
 * Single place that knows the hub request contract.
 * Supports `{query}` / `{page}` placeholders, otherwise appends query params.
 */
function buildHubUrl(endpoint: string, query: string, page: number): string {
  if (endpoint.includes("{query}") || endpoint.includes("{page}")) {
    return endpoint
      .replace("{query}", encodeURIComponent(query))
      .replace("{page}", String(page));
  }
  const url = new URL(endpoint);
  if (query) url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));
  return url.toString();
}

function hubHeaders(): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.RAPIDAPI_KEY?.trim();
  const endpoint = readEndpoint();
  // Only attach credentials when the hub is hosted behind the same gateway.
  if (key && endpoint && /rapidapi\.com|rapidapi\.io/.test(endpoint)) {
    headers["x-rapidapi-key"] = key;
    try {
      headers["x-rapidapi-host"] = new URL(endpoint).host;
    } catch {
      /* ignore */
    }
  }
  return headers;
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
      headers: hubHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchHubFeed(options: {
  query: string;
  page: number;
  signal?: AbortSignal;
}): Promise<HubResponse> {
  const query = options.query.slice(0, 120);
  const page = Number.isFinite(options.page) ? Math.max(0, Math.floor(options.page)) : 0;
  const endpoint = readEndpoint();

  if (!endpoint) {
    await new Promise((resolve) => setTimeout(resolve, 420));
    return normalizeHubFeed(mockHubUpstream(query, page), { query, page });
  }

  try {
    const { ok, status, body } = await requestJson(
      buildHubUrl(endpoint, query, page),
      options.signal,
    );
    if (!ok) {
      if (status === 429) return hubError("RATE_LIMITED");
      if (status === 404) return hubError("NOT_FOUND");
      if (status === 408 || status === 504) return hubError("TIMEOUT");
      return hubError("UPSTREAM_ERROR");
    }
    return normalizeHubFeed(body, { query, page });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === "AbortError" || name === "TimeoutError") return hubError("TIMEOUT");
    return hubError("NETWORK_ERROR");
  }
}

/** Separate resolver: turns a hub entry id into a playable stream URL. */
export async function resolveHubStream(options: {
  id: string;
  signal?: AbortSignal;
}): Promise<HubResolved> {
  const id = options.id.trim().slice(0, 200);
  if (!id) return hubError("BAD_QUERY");
  const endpoint = readEndpoint();

  const toResolved = (raw: unknown): HubResolved => {
    if (typeof raw !== "object" || raw === null) return hubError("MALFORMED_RESPONSE");
    const rec = raw as Record<string, unknown>;
    const candidates = ["stream_url", "streamUrl", "hls", "playback_url", "url", "video_url"];
    let url: string | undefined;
    for (const key of candidates) {
      const value = rec[key];
      if (isSafeMediaUrl(value)) {
        url = value.trim();
        break;
      }
    }
    if (!url) return hubError("NOT_FOUND");
    const download = rec.download_url ?? rec.downloadUrl;
    const expires = rec.expires_at ?? rec.expiresAt;
    return {
      success: true,
      id,
      playback: {
        url,
        type: url.split(/[?#]/)[0].toLowerCase().endsWith(".m3u8") ? "hls" : "mp4",
      },
      ...(isSafeMediaUrl(download) ? { downloadUrl: download.trim() } : {}),
      ...(typeof expires === "string" ? { expiresAt: expires } : {}),
    };
  };

  if (!endpoint) {
    await new Promise((resolve) => setTimeout(resolve, 220));
    return toResolved(mockHubResolve(id));
  }

  try {
    const url = new URL(endpoint.replace(/\{query\}|\{page\}/g, ""));
    url.searchParams.set("id", id);
    const { ok, status, body } = await requestJson(url.toString(), options.signal);
    if (!ok) {
      if (status === 429) return hubError("RATE_LIMITED");
      if (status === 404) return hubError("NOT_FOUND");
      return hubError("UPSTREAM_ERROR");
    }
    return toResolved(body);
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === "AbortError" || name === "TimeoutError") return hubError("TIMEOUT");
    return hubError("NETWORK_ERROR");
  }
}
