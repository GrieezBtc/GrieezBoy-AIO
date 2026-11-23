import type { SupportedPlatform } from "@/services/aioDownloader/types";

/** Platforms a visitor without an account may use. Everything else needs a login. */
export const GUEST_PLATFORMS: SupportedPlatform[] = ["snapchat", "threads"];

/** Shown in the interface only — the real values live in supabase/coins.sql. */
export const WELCOME_COINS = 10;
export const COIN_COST = 1;

export function isGuestPlatform(platform: SupportedPlatform): boolean {
  return GUEST_PLATFORMS.includes(platform);
}

/** guest = no account, member = account paying with coins, premium = unlimited */
export type AccessStatus = "guest" | "member" | "premium";
