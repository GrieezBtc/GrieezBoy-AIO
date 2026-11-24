import { codeFromHttpStatus, codeFromUpstreamText, downloadError } from "../errors";
import { normalizeAioResponse } from "../normalizer";
import type { AioResponse, SupportedPlatform } from "../types";

const ENDPOINT = "https://api.saveapi.org/v1/download";
const REQUEST_TIMEOUT_MS = 45_000;

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function resolveSaveApi(
  url: string,
  platform: SupportedPlatform,
  signal?: AbortSignal,
): Promise<AioResponse> {
  const apiKey = process.env.SAVEAPI_API_KEY?.trim();

  if (!apiKey) {
    return downloadError("UPSTREAM_ERROR");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const endpoint = new URL(ENDPOINT);
    endpoint.searchParams.set("url", url);

    const shortUrl = url.length > 90 ? `${url.slice(0, 90)}…` : url;
    let response: Response | null = null;
    let body: unknown = null;

    // One retry for failures that are usually temporary on the provider's side.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        response = await fetch(endpoint.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            accept: "application/json",
          },
          signal: controller.signal,
          cache: "no-store",
        });
      } catch (fetchError) {
        const fetchName = (fetchError as { name?: string } | null)?.name;
        if (attempt === 1 && fetchName !== "AbortError" && fetchName !== "TimeoutError") {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        throw fetchError;
      }

      body = await readBody(response);

      const transient =
        response.status >= 500 ||
        response.status === 429 ||
        (platform === "snapchat" && response.status === 404);
      if (response.ok || !transient || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    if (!response) return downloadError("NETWORK_ERROR");

    if (!response.ok) {
      const hint =
        typeof body === "string" ? body : JSON.stringify(body ?? "");

      const textCode = codeFromUpstreamText(hint.slice(0, 500));
      const code =
        textCode === "UPSTREAM_ERROR"
          ? codeFromHttpStatus(response.status)
          : textCode;

      // Shows the real reason in the Vercel logs (never shown to visitors).
      console.error(
        `[saveapi] ${platform} http=${response.status} -> ${code} url=${shortUrl} body=${hint.slice(0, 300)}`,
      );

      return downloadError(code);
    }

    if (!body || typeof body !== "object") {
      return downloadError("MALFORMED_RESPONSE");
    }

    const normalized = normalizeAioResponse(body, {
      url,
      platform,
    });

    if (!normalized.success) {
      console.error(
        `[saveapi] ${platform} ok-response -> ${normalized.error.code} url=${shortUrl} body=${JSON.stringify(body).slice(0, 300)}`,
      );
    }

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
