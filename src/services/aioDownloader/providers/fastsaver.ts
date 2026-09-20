import { codeFromHttpStatus, codeFromUpstreamText, downloadError } from "../errors";
import { normalizeAioResponse } from "../normalizer";
import type { AioResponse, SupportedPlatform } from "../types";

const BASE_URL = "https://api.fastsaver.io/v1";
const REQUEST_TIMEOUT_MS = 20_000;

type FastSaverBody = Record<string, unknown>;

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function key(): string | null {
  const value = process.env.FASTSAVER_API_KEY?.trim();
  return value || null;
}

export async function resolveFastSaver(
  url: string,
  platform: SupportedPlatform,
  signal?: AbortSignal,
): Promise<AioResponse> {
  const apiKey = key();
  if (!apiKey) return downloadError("UPSTREAM_ERROR");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const infoUrl = new URL(`${BASE_URL}/youtube/info`);
    infoUrl.searchParams.set("url", url);

    /*
     * FastSaver uses the same API family for supported platforms.
     * YouTube exposes format selection through /youtube/download.
     * Other supported platforms are resolved through /fetch.
     */
    const endpoint =
      platform === "youtube"
        ? infoUrl.toString()
        : `${BASE_URL}/fetch?url=${encodeURIComponent(url)}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const body = await readBody(response);

    if (!response.ok) {
      const hint =
        typeof body === "string" ? body : JSON.stringify(body ?? "");
      const textCode = codeFromUpstreamText(hint.slice(0, 500));
      const code =
        textCode === "UPSTREAM_ERROR"
          ? codeFromHttpStatus(response.status)
          : textCode;

      return downloadError(code);
    }

    if (!body || typeof body !== "object") {
      return downloadError("MALFORMED_RESPONSE");
    }

    if (platform === "youtube") {
      return resolveYoutube(body as FastSaverBody, url, signal);
    }

    return normalizeAioResponse(body, { url, platform });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;

    if (name === "AbortError" || name === "TimeoutError") {
      return downloadError("TIMEOUT");
    }

    return downloadError("NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function resolveYoutube(
  body: FastSaverBody,
  url: string,
  signal?: AbortSignal,
): Promise<AioResponse> {
  const formats = Array.isArray(body.formats) ? body.formats : [];

  const preferred =
    formats.find(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).type === "video" &&
        (item as Record<string, unknown>).format === "720p",
    ) ??
    formats.find(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).type === "video",
    );

  if (!preferred || typeof preferred !== "object") {
    return downloadError("NO_MEDIA");
  }

  const format =
    typeof (preferred as Record<string, unknown>).format === "string"
      ? (preferred as Record<string, unknown>).format as string
      : "720p";

  const apiKey = key();
  if (!apiKey) return downloadError("UPSTREAM_ERROR");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(`${BASE_URL}/youtube/download`, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ url, format }),
      signal: controller.signal,
      cache: "no-store",
    });

    const result = await readBody(response);

    if (!response.ok) {
      const hint =
        typeof result === "string" ? result : JSON.stringify(result ?? "");
      const textCode = codeFromUpstreamText(hint.slice(0, 500));
      const code =
        textCode === "UPSTREAM_ERROR"
          ? codeFromHttpStatus(response.status)
          : textCode;

      return downloadError(code);
    }

    if (!result || typeof result !== "object") {
      return downloadError("MALFORMED_RESPONSE");
    }

    const downloadUrl =
      typeof (result as FastSaverBody).download_url === "string"
        ? (result as FastSaverBody).download_url
        : undefined;

    if (!downloadUrl) {
      return downloadError("NO_MEDIA");
    }

    const normalized = normalizeAioResponse(
      {
        platform: "youtube",
        title: body.title,
        thumbnail: body.thumbnail,
        duration: body.duration,
        download_url: downloadUrl,
        format,
      },
      { url, platform: "youtube" },
    );

    return normalized;
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;

    if (name === "AbortError" || name === "TimeoutError") {
      return downloadError("TIMEOUT");
    }

    return downloadError("NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}
