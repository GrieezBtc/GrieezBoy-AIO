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

    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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

    return normalizeAioResponse(body, {
      url,
      platform,
    });
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
