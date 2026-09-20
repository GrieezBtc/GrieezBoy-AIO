import type { SupportedPlatform } from "./types";

export type PlatformMeta = {
  id: SupportedPlatform;
  label: string;
  short: string;
  /** css color token used for the accent of that platform */
  accent: string;
  hint: string;
  example: string;
};

export const PLATFORMS: PlatformMeta[] = [
  {
    id: "youtube",
    label: "YouTube",
    short: "YT",
    accent: "#ff3b4e",
    hint: "videos · shorts · music",
    example: "https://youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    id: "tiktok",
    label: "TikTok",
    short: "TT",
    accent: "#25f4ee",
    hint: "video · no watermark",
    example: "https://www.tiktok.com/@user/video/7300000000000000000",
  },
  {
    id: "instagram",
    label: "Instagram",
    short: "IG",
    accent: "#f65ba7",
    hint: "reels · posts · stories",
    example: "https://www.instagram.com/reel/CxAbCdEfGhI/",
  },
  {
    id: "facebook",
    label: "Facebook",
    short: "FB",
    accent: "#3d8bff",
    hint: "video · reels · watch",
    example: "https://www.facebook.com/watch/?v=1234567890",
  },
  {
    id: "twitter",
    label: "Twitter / X",
    short: "X",
    accent: "#c9d3e0",
    hint: "video · gif · image",
    example: "https://x.com/user/status/1700000000000000000",
  },
  {
    id: "pinterest",
    label: "Pinterest",
    short: "PIN",
    accent: "#ff5c6b",
    hint: "pins · idea pins",
    example: "https://www.pinterest.com/pin/1234567890/",
  },
  {
    id: "threads",
    label: "Threads",
    short: "TH",
    accent: "#9d8bff",
    hint: "posts · media",
    example: "https://www.threads.net/@user/post/CxAbCdEfGhI",
  },
  {
    id: "snapchat",
    label: "Snapchat",
    short: "SC",
    accent: "#ffd400",
    hint: "stories · spotlight · media",
    example: "https://www.snapchat.com/spotlight/...",
  },
];

export const PLATFORM_MAP: Record<SupportedPlatform, PlatformMeta> =
  PLATFORMS.reduce(
    (acc, p) => {
      acc[p.id] = p;
      return acc;
    },
    {} as Record<SupportedPlatform, PlatformMeta>,
  );

export function platformLabel(platform: SupportedPlatform): string {
  return PLATFORM_MAP[platform].label;
}

const HOST_RULES: Array<[RegExp, SupportedPlatform]> = [
  [/(^|\.)youtube\.com$/i, "youtube"],
  [/(^|\.)youtu\.be$/i, "youtube"],
  [/(^|\.)youtube-nocookie\.com$/i, "youtube"],
  [/(^|\.)music\.youtube\.com$/i, "youtube"],
  [/(^|\.)tiktok\.com$/i, "tiktok"],
  [/(^|\.)vm\.tiktok\.com$/i, "tiktok"],
  [/(^|\.)instagram\.com$/i, "instagram"],
  [/(^|\.)instagr\.am$/i, "instagram"],
  [/(^|\.)ddinstagram\.com$/i, "instagram"],
  [/(^|\.)facebook\.com$/i, "facebook"],
  [/(^|\.)fb\.watch$/i, "facebook"],
  [/(^|\.)fb\.com$/i, "facebook"],
  [/(^|\.)m\.facebook\.com$/i, "facebook"],
  [/(^|\.)twitter\.com$/i, "twitter"],
  [/(^|\.)x\.com$/i, "twitter"],
  [/(^|\.)t\.co$/i, "twitter"],
  [/(^|\.)fxtwitter\.com$/i, "twitter"],
  [/(^|\.)pinterest\.[a-z.]+$/i, "pinterest"],
  [/(^|\.)pin\.it$/i, "pinterest"],
  [/(^|\.)threads\.net$/i, "threads"],
  [/(^|\.)threads\.com$/i, "threads"],
  [/(^|\.)snapchat\.com$/i, "snapchat"],
];

const NAME_ALIASES: Record<string, SupportedPlatform> = {
  youtube: "youtube",
  yt: "youtube",
  youtu: "youtube",
  ytshorts: "youtube",
  "youtube music": "youtube",
  tiktok: "tiktok",
  tik_tok: "tiktok",
  douyin: "tiktok",
  instagram: "instagram",
  ig: "instagram",
  insta: "instagram",
  reels: "instagram",
  facebook: "facebook",
  fb: "facebook",
  meta: "facebook",
  twitter: "twitter",
  x: "twitter",
  "x.com": "twitter",
  "twitter.com": "twitter",
  tweet: "twitter",
  pinterest: "pinterest",
  pin: "pinterest",
  threads: "threads",
  thread: "threads",
  snapchat: "snapchat",
  snap: "snapchat",
};

/** Normalizes a free-form platform name (twitter, x, x.com -> twitter). */
export function normalizePlatformName(
  value: unknown,
): SupportedPlatform | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase();
  if (!key) return undefined;
  if (NAME_ALIASES[key]) return NAME_ALIASES[key];
  const stripped = key.replace(/^www\./, "").replace(/\.(com|net|org|be|it)$/, "");
  if (NAME_ALIASES[stripped]) return NAME_ALIASES[stripped];
  const detected = detectPlatform(key);
  return detected ?? undefined;
}

/** Returns the platform for a URL string, or null when unrecognised. */
export function detectPlatform(input: string): SupportedPlatform | null {
  const parsed = parseHttpUrl(input);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  for (const [pattern, platform] of HOST_RULES) {
    if (pattern.test(host)) return platform;
  }
  return null;
}

/** Parses a URL, tolerating a missing scheme, and enforcing http(s). */
export function parseHttpUrl(input: string): URL | null {
  const raw = (input ?? "").trim();
  if (!raw || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  return url;
}

export function isSafeMediaUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 4000) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
