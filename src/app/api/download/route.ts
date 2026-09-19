import { clientKey, rateLimit } from "@/lib/rateLimit";
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
];

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_URL: 400,
  UNSUPPORTED_PLATFORM: 400,
  PRIVATE_CONTENT: 403,
  CONTENT_NOT_FOUND: 404,
  RATE_LIMITED: 429,
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

  const cacheKey = `aio:${resolvedPlatform}:${parsed.toString()}`;
  const cached = await cacheGet<AioResponse>(cacheKey);
  if (cached && cached.success) return respond(cached);

  const result = await resolveDownload({
    url: parsed.toString(),
    platform: resolvedPlatform,
    signal: request.signal,
  });

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
