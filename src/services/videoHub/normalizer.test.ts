import { describe, expect, it } from "vitest";
import { mockHubUpstream } from "./mock";
import { normalizeHubFeed, normalizeHubVideo } from "./normalizer";

describe("video hub normalizer", () => {
  it("normalizes a mock feed page", () => {
    const feed = normalizeHubFeed(mockHubUpstream("", 0), { query: "", page: 0 });
    expect(feed.success).toBe(true);
    if (!feed.success) return;
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.hasMore).toBe(true);
    for (const item of feed.items) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.thumbnailUrl?.startsWith("https://")).toBe(true);
    }
  });

  it("flags entries that require the separate resolver", () => {
    const feed = normalizeHubFeed(mockHubUpstream("", 0), { query: "", page: 0 });
    if (!feed.success) throw new Error("expected feed");
    expect(feed.items.some((item) => item.playback.needsResolve)).toBe(true);
  });

  it("detects hls playback", () => {
    const video = normalizeHubVideo(
      { id: "x", title: "stream", stream_url: "https://cdn.example.com/master.m3u8" },
      0,
    );
    expect(video?.playback.type).toBe("hls");
    expect(video?.playback.needsResolve).toBe(false);
  });

  it("returns an empty feed for a query with no matches", () => {
    const feed = normalizeHubFeed(mockHubUpstream("empty", 0), { query: "empty", page: 0 });
    expect(feed.success).toBe(true);
    if (!feed.success) return;
    expect(feed.items).toHaveLength(0);
    expect(feed.hasMore).toBe(false);
  });

  it("maps malformed payloads and upstream failures", () => {
    const malformed = normalizeHubFeed("<html>", { query: "", page: 0 });
    expect(malformed.success).toBe(false);
    if (malformed.success) return;
    expect(malformed.error.code).toBe("MALFORMED_RESPONSE");

    const limited = normalizeHubFeed(
      { success: false, error: "rate limit exceeded" },
      { query: "", page: 0 },
    );
    expect(limited.success).toBe(false);
    if (limited.success) return;
    expect(limited.error.code).toBe("RATE_LIMITED");
  });

  it("drops entries without any usable media reference", () => {
    expect(normalizeHubVideo({ title: "nothing here" }, 0)).toBeNull();
    expect(normalizeHubVideo("nope", 0)).toBeNull();
  });
});
