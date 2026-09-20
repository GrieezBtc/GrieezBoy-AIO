import { downloadError } from "./errors";
import { resolveFastSaver } from "./providers/fastsaver";
import { resolveSaveApi } from "./providers/saveapi";
import { detectPlatform, parseHttpUrl } from "./platforms";
import type { AioResponse, SupportedPlatform } from "./types";

export type AioRequestInput = {
  url: string;
  platform?: SupportedPlatform;
  signal?: AbortSignal;
};

const FASTSAVER_PLATFORMS: SupportedPlatform[] = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "twitter",
  "pinterest",
];

const SAVEAPI_PLATFORMS: SupportedPlatform[] = [
  "threads",
  "snapchat",
];

export function isAioLive(): boolean {
  return Boolean(
    process.env.FASTSAVER_API_KEY?.trim() ||
    process.env.SAVEAPI_API_KEY?.trim(),
  );
}

export async function resolveDownload({
  url,
  platform,
  signal,
}: AioRequestInput): Promise<AioResponse> {
  const parsed = parseHttpUrl(url);

  if (!parsed) {
    return downloadError("INVALID_URL");
  }

  const target = parsed.toString();
  const detected = platform ?? detectPlatform(target);

  if (!detected) {
    return downloadError("UNSUPPORTED_PLATFORM");
  }

  if (FASTSAVER_PLATFORMS.includes(detected)) {
    return resolveFastSaver(target, detected, signal);
  }

  if (SAVEAPI_PLATFORMS.includes(detected)) {
    return resolveSaveApi(target, detected, signal);
  }

  return downloadError("UNSUPPORTED_PLATFORM");
}
