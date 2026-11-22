import type { SupportedPlatform } from "@/services/aioDownloader/types";

/** Platforms a visitor without an account may use. Everything else needs a login. */
export const GUEST_PLATFORMS: SupportedPlatform[] = ["snapchat", "threads"];

export const TRIAL_DAYS = 7;
export const DAILY_LIMIT = 3;

export function isGuestPlatform(platform: SupportedPlatform): boolean {
  return GUEST_PLATFORMS.includes(platform);
}

export type AccessStatus = "guest" | "trial" | "trial_expired" | "premium";
