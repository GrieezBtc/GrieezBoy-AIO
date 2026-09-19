import { codeFromHttpStatus, codeFromUpstreamText, downloadError } from "./errors";
import { mockAioUpstream } from "./mock";
import { normalizeAioResponse } from "./normalizer";
import { detectPlatform, parseHttpUrl } from "./platforms";
import type { AioResponse, SupportedPlatform } from "./types";

const REQUEST_TIMEOUT_MS = 20_000;

type AioConfig = {
  key: string;
  host: string;
  endpoint: string;
};

/** Reads server-only configuration. Never import this from client code. */
function readConfig(): AioConfig | null {
  const key = process.env.RAPIDAPI_KEY?.trim();
  const host = process.env.RAPIDAPI_HOST?.trim();
  const endpoint = process.env.RAPIDAPI_AIO_ENDPOINT?.trim();
  if (!key || !endpoint) return null;
  return { key, host: host ?? new URL(endpoint).host, endpoint };
}

export function isAioLive(): boolean {
  return readConfig() !== null;
}

/**
 * Builds the upstream request. This is the single place to adapt when the
 * real RapidAPI contract is supplied.
 *
 *  - endpoint containing `{url}` -> GET with the encoded url substituted
 *  - endpoint ending in `?` or containing `=` -> GET with `url` query param
 *  - otherwise -> POST { url }
 */
export function buildUpstreamRequest(
  config: AioConfig,
  targetUrl: string,
): { input: string; init: RequestInit } {
  const headers: Record<string, string> = {
    "x-rapidapi-key": config.key,
    "x-rapidapi-host": config.host,
    accept: "application/json",
  };

  if (config.endpoint.includes("{url}")) {
    return {
      input: config.endpoint.replace("{url}", encodeURIComponent(targetUrl)),
      init: { method: "GET", headers },
    };
  }

  if (config.endpoint.includes("?")) {
    const parsed = new URL(config.endpoint);
    if (!parsed.searchParams.has("url")) parsed.searchParams.set("url", targetUrl);
    else parsed.searchParams.set("url", targetUrl);
    return { input: parsed.toString(), init: { method: "GET", headers } };
  }

  return {
    input: config.endpoint,
    init: {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ url: targetUrl }),
    },
  };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export type AioRequestInput = {
  url: string;
  platform?: SupportedPlatform;
  signal?: AbortSignal;
};

/**
 * Resolves a media URL into the normalized contract.
 * Always resolves - never throws - so routes stay thin.
 */
export async function resolveDownload({
  url,
  platform,
  signal,
}: AioRequestInput): Promise<AioResponse> {
  const parsed = parseHttpUrl(url);
  if (!parsed) return downloadError("INVALID_URL");

  const target = parsed.toString();
  const detected = platform ?? detectPlatform(target);
  if (!detected) return downloadError("UNSUPPORTED_PLATFORM");

  const config = readConfig();
  if (!config) {
    // Mock adapter keeps the architecture identical while credentials are absent.
    await new Promise((resolve) => setTimeout(resolve, 650));
    return normalizeAioResponse(mockAioUpstream(target, detected), {
      url: target,
      platform: detected,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const { input, init } = buildUpstreamRequest(config, target);
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    const body = await readBody(response);

    if (!response.ok) {
      const hint = typeof body === "string" ? body : JSON.stringify(body ?? "");
      const textCode = codeFromUpstreamText(hint.slice(0, 500));
      const code =
        textCode === "UPSTREAM_ERROR" ? codeFromHttpStatus(response.status) : textCode;
      return downloadError(code);
    }

    return normalizeAioResponse(body, { url: target, platform: detected });
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
