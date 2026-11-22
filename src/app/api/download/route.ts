import { clientKey, rateLimit } from "@/lib/rateLimit";
import { after } from "next/server";
import { gateDownload } from "@/lib/gate";
import { requestContext } from "@/lib/track";
import { cacheGet, cacheSet } from "@/lib/serverCache";
import { resolveDownload } from "@/services/aioDownloader/client";
import { downloadError } from "@/services/aioDownloader/errors";
import { detectPlatform, parseHttpUrl } from "@/services/aioDownloader/platforms";
import type { AioResponse, SupportedPlatform } from "@/services/aioDownloader/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_PLATFORMS: SupportedPlatform[] = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "twitter",
  "pinterest",
  "threads",
  "snapchat",
];

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_URL: 400,
  UNSUPPORTED_PLATFORM: 400,
  PRIVATE_CONTENT: 403,
  CONTENT_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  AUTH_REQUIRED: 401,
  TRIAL_EXPIRED: 402,
  DAILY_LIMIT: 429,
  PROVIDER_QUOTA_EXCEEDED: 503,
  TIMEOUT: 504,
  NO_MEDIA: 404,
};

function respond(payload: AioResponse): Response {
  const status = payload.success ? 200 : (STATUS_BY_CODE[payload.error.code] ?? 502);
  return Response.json(payload, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "download"), 20, 60_000);
  if (!limit.allowed) {
    return Response.json(downloadError("RATE_LIMITED"), {
      status: 429,
      headers: { "retry-after": String(limit.retryAfterSeconds) },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(downloadError("INVALID_URL"));
  }

  if (typeof body !== "object" || body === null) {
    return respond(downloadError("INVALID_URL"));
  }

  const { url, platform } = body as { url?: unknown; platform?: unknown };
  if (typeof url !== "string" || url.length > 2048) {
    return respond(downloadError("INVALID_URL"));
  }

  const parsed = parseHttpUrl(url);
  if (!parsed) return respond(downloadError("INVALID_URL"));

  const requested =
    typeof platform === "string" && VALID_PLATFORMS.includes(platform as SupportedPlatform)
      ? (platform as SupportedPlatform)
      : undefined;
  const resolvedPlatform = requested ?? detectPlatform(parsed.toString());
  if (!resolvedPlatform) return respond(downloadError("UNSUPPORTED_PLATFORM"));

  // Gate on BOTH the claimed platform and the platform the link really belongs to,
  // so a guest cannot send platform:"snapchat" with a YouTube link.
  const actualPlatform = detectPlatform(parsed.toString());
  const gate = await gateDownload(
    actualPlatform && actualPlatform !== resolvedPlatform
      ? [resolvedPlatform, actualPlatform]
      : [resolvedPlatform],
    requestContext(request),
  );
  if (!gate.ok) {
    after(() => gate.log("blocked", { code: gate.error.error.code, platform: resolvedPlatform }));
    return respond(gate.error);
  }

  const cacheKey = `aio:${resolvedPlatform}:${parsed.toString()}`;
  const cached = await cacheGet<AioResponse>(cacheKey);
  if (cached && cached.success) {
    after(() => gate.log("download", { platform: resolvedPlatform }));
    return respond(cached);
  }

  const result = await resolveDownload({
    url: parsed.toString(),
    platform: resolvedPlatform,
    signal: request.signal,
  });

  if (!result.success) await gate.refund();
  after(() =>
    gate.log(result.success ? "download" : "download_failed", {
      platform: resolvedPlatform,
      ...(result.success ? {} : { code: result.error.code }),
    }),
  );

  if (result.success) {
    // Short TTL: many providers hand out expiring URLs.
    await cacheSet(cacheKey, "aio", result, 300);
  }

  return respond(result);
}

export async function GET() {
  return Response.json(
    { success: false, error: { code: "INVALID_URL", message: "Use POST with a JSON body { url }.", retryable: false } },
    { status: 405 },
  );
}
