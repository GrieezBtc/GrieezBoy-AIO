import { describe, expect, it } from "vitest";
import { mockAioUpstream } from "./mock";
import { normalizeAioResponse } from "./normalizer";
import { detectPlatform, normalizePlatformName } from "./platforms";
import type { SupportedPlatform } from "./types";

const SOURCE_URLS: Record<SupportedPlatform, string> = {
  youtube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  tiktok: "https://www.tiktok.com/@user/video/7300000000000000000",
  instagram: "https://www.instagram.com/reel/CxAbCdEfGhI/",
  facebook: "https://www.facebook.com/watch/?v=1234567890",
  twitter: "https://x.com/user/status/1700000000000000000",
  pinterest: "https://www.pinterest.com/pin/1234567890/",
  threads: "https://www.threads.net/@user/post/CxAbCdEfGhI",
};

const PLATFORMS = Object.keys(SOURCE_URLS) as SupportedPlatform[];

describe("platform detection", () => {
  it.each(PLATFORMS)("detects %s from its canonical url", (platform) => {
    expect(detectPlatform(SOURCE_URLS[platform])).toBe(platform);
  });

  it("normalizes twitter aliases", () => {
    expect(normalizePlatformName("twitter")).toBe("twitter");
    expect(normalizePlatformName("x")).toBe("twitter");
    expect(normalizePlatformName("x.com")).toBe("twitter");
    expect(normalizePlatformName("X.COM")).toBe("twitter");
    expect(detectPlatform("https://twitter.com/a/status/1")).toBe("twitter");
  });

  it("rejects unsupported and non-http sources", () => {
    expect(detectPlatform("https://vimeo.com/12345")).toBeNull();
    expect(detectPlatform("ftp://youtube.com/watch?v=1")).toBeNull();
    expect(detectPlatform("javascript:alert(1)")).toBeNull();
  });
});

describe("normalizeAioResponse — all seven platforms", () => {
  it.each(PLATFORMS)("normalizes a %s payload", (platform) => {
    const url = SOURCE_URLS[platform];
    const result = normalizeAioResponse(mockAioUpstream(url, platform), { url });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.source.platform).toBe(platform);
    expect(result.source.url).toBe(url);
    expect(result.options.length).toBeGreaterThan(0);

    for (const option of result.options) {
      expect(option.url.startsWith("http")).toBe(true);
      expect(option.label.length).toBeGreaterThan(0);
      expect(["video", "audio", "image"]).toContain(option.type);
    }

    const urls = result.options.map((option) => option.url);
    expect(new Set(urls).size).toBe(urls.length);

    const ids = result.options.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sorts video options by descending quality, then audio, then image", () => {
    const url = SOURCE_URLS.youtube;
    const result = normalizeAioResponse(mockAioUpstream(url, "youtube"), { url });
    if (!result.success) throw new Error("expected success");

    const types = result.options.map((option) => option.type);
    expect(types[0]).toBe("video");
    expect(types.at(-1)).toBe("audio");

    const videoHeights = result.options
      .filter((option) => option.type === "video")
      .map((option) => option.resolution?.height ?? 0);
    const sorted = [...videoHeights].sort((a, b) => b - a);
    expect(videoHeights).toEqual(sorted);
  });

  it("extracts metadata without fabricating values", () => {
    const url = SOURCE_URLS.tiktok;
    const result = normalizeAioResponse(mockAioUpstream(url, "tiktok"), { url });
    if (!result.success) throw new Error("expected success");

    expect(result.media.title).toContain("patchbay");
    expect(result.media.author?.name).toBe("patchbay.kid");
    expect(result.media.durationSeconds).toBe(42);
    expect(result.media.durationLabel).toBe("0:42");
  });

  it("keeps every variant a single record exposes (hd / sd / audio)", () => {
    const url = SOURCE_URLS.tiktok;
    const result = normalizeAioResponse(mockAioUpstream(url, "tiktok"), { url });
    if (!result.success) throw new Error("expected success");

    expect(result.options.length).toBeGreaterThanOrEqual(3);
    expect(result.options.some((option) => option.qualityLabel === "HD")).toBe(true);
    expect(result.options.some((option) => option.type === "audio")).toBe(true);
    const hd = result.options.find((option) => option.qualityLabel === "HD");
    expect(hd?.fileSize).toBe(12_774_221);
  });

  it("never turns the source page url into a download option", () => {
    const url = SOURCE_URLS.threads;
    const result = normalizeAioResponse(mockAioUpstream(url, "threads"), { url });
    if (!result.success) throw new Error("expected success");
    expect(result.options.some((option) => option.url === url)).toBe(false);
  });

  it("marks carousels when several images and no video exist", () => {
    const url = SOURCE_URLS.pinterest;
    const result = normalizeAioResponse(mockAioUpstream(url, "pinterest"), { url });
    if (!result.success) throw new Error("expected success");
    expect(result.media.kind).toBe("carousel");
    expect(result.options.every((option) => option.type === "image")).toBe(true);
  });

  it("preserves expiring urls with an ISO expiresAt", () => {
    const url = SOURCE_URLS.threads;
    const result = normalizeAioResponse(mockAioUpstream(url, "threads"), { url });
    if (!result.success) throw new Error("expected success");
    const expiring = result.options.find((option) => option.expiresAt);
    expect(expiring).toBeDefined();
    expect(Number.isNaN(Date.parse(expiring!.expiresAt!))).toBe(false);
  });
});

describe("normalizeAioResponse — sanitization", () => {
  const url = SOURCE_URLS.youtube;

  it("drops empty, malformed and unsafe urls", () => {
    const result = normalizeAioResponse(
      {
        platform: "youtube",
        title: "sanitize me",
        medias: [
          { url: "", quality: "1080p" },
          { url: "   ", quality: "720p" },
          { url: "javascript:alert(1)", quality: "480p" },
          { url: "ftp://example.com/video.mp4", quality: "360p" },
          { url: "not a url", quality: "240p" },
          { url: "https://cdn.example.com/a.mp4", quality: "1080p" },
        ],
      },
      { url },
    );
    if (!result.success) throw new Error("expected success");
    expect(result.options).toHaveLength(1);
    expect(result.options[0].url).toBe("https://cdn.example.com/a.mp4");
  });

  it("deduplicates repeated download urls", () => {
    const result = normalizeAioResponse(
      {
        platform: "youtube",
        title: "duplicates",
        medias: [
          { url: "https://cdn.example.com/a.mp4", quality: "1080p" },
          { url: "https://cdn.example.com/a.mp4", quality: "1080p" },
          { url: "https://cdn.example.com/a.mp4", quality: "720p" },
          { url: "https://cdn.example.com/b.mp4", quality: "720p" },
        ],
      },
      { url },
    );
    if (!result.success) throw new Error("expected success");
    expect(result.options).toHaveLength(2);
  });

  it("converts file sizes and durations when possible", () => {
    const result = normalizeAioResponse(
      {
        platform: "youtube",
        title: "conversions",
        duration: "03:21",
        medias: [{ url: "https://cdn.example.com/a.mp4", quality: "1080p", size: "12.5 MB" }],
      },
      { url },
    );
    if (!result.success) throw new Error("expected success");
    expect(result.media.durationSeconds).toBe(201);
    expect(result.media.durationLabel).toBe("3:21");
    expect(result.options[0].fileSize).toBe(Math.round(12.5 * 1024 * 1024));
    expect(result.options[0].fileSizeLabel).toBe("12.5 MB");
  });

  it("keeps every distinct quality the provider returned", () => {
    const qualities = ["2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"];
    const result = normalizeAioResponse(
      {
        platform: "youtube",
        title: "ladder",
        medias: qualities.map((quality, index) => ({
          url: `https://cdn.example.com/${index}.mp4`,
          quality,
        })),
      },
      { url },
    );
    if (!result.success) throw new Error("expected success");
    expect(result.options).toHaveLength(qualities.length);
    expect(result.options.map((option) => option.quality)).toEqual(qualities);
  });
});

describe("normalizeAioResponse — error contract", () => {
  const url = SOURCE_URLS.youtube;

  it("returns MALFORMED_RESPONSE for unreadable payloads", () => {
    for (const payload of [null, undefined, 42, "<html>nope</html>", true]) {
      const result = normalizeAioResponse(payload, { url });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.code).toBe("MALFORMED_RESPONSE");
    }
  });

  it("returns NO_MEDIA when a valid payload has no usable media", () => {
    const result = normalizeAioResponse(
      { platform: "youtube", title: "text only post", medias: [] },
      { url },
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("NO_MEDIA");
    expect(result.error.retryable).toBe(false);
  });

  it("maps private / restricted upstream errors", () => {
    const result = normalizeAioResponse(
      { success: false, error: "This content is private and requires login" },
      { url },
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("PRIVATE_CONTENT");
  });

  it("maps rate limit upstream errors as retryable", () => {
    const result = normalizeAioResponse(
      { status: "error", message: "Too Many Requests - rate limit exceeded" },
      { url },
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("RATE_LIMITED");
    expect(result.error.retryable).toBe(true);
  });

  it("maps missing content upstream errors", () => {
    const result = normalizeAioResponse(
      { error: { message: "Video not found or has been deleted" } },
      { url },
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("CONTENT_NOT_FOUND");
  });

  it("maps generic upstream failures without leaking the raw message", () => {
    const raw = "TypeError: Cannot read property 'x' of undefined at /srv/app/index.js:42";
    const result = normalizeAioResponse({ success: false, error: raw }, { url });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("UPSTREAM_ERROR");
    expect(result.error.message).not.toContain("TypeError");
    expect(result.error.message).not.toContain("/srv/app");
  });

  it("returns UNSUPPORTED_PLATFORM when the source cannot be attributed", () => {
    const result = normalizeAioResponse(
      { medias: [{ url: "https://cdn.example.com/a.mp4" }] },
      { url: "https://vimeo.com/12345" },
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("UNSUPPORTED_PLATFORM");
  });
});
