import { formatCount, formatDuration, parseDurationSeconds } from "@/lib/format";
import { isSafeMediaUrl } from "@/services/aioDownloader/platforms";
import type {
  HubError,
  HubErrorCode,
  HubPlaybackType,
  HubResponse,
  HubVideo,
} from "./types";

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
};

const num = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return undefined;
};

const pick = (node: Rec, keys: string[]): unknown => {
  for (const key of keys) {
    const value = node[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const HUB_MESSAGES: Record<HubErrorCode, { message: string; retryable: boolean }> = {
  BAD_QUERY: { message: "That search query can't be processed.", retryable: false },
  NOT_FOUND: { message: "No entries matched this query.", retryable: false },
  RATE_LIMITED: { message: "Hub throttled the request. Retry in a moment.", retryable: true },
  TIMEOUT: { message: "The hub feed timed out.", retryable: true },
  UPSTREAM_ERROR: { message: "The hub feed is temporarily unavailable.", retryable: true },
  MALFORMED_RESPONSE: { message: "The hub returned an unreadable payload.", retryable: true },
  NETWORK_ERROR: { message: "Connection to the hub failed.", retryable: true },
  UNKNOWN: { message: "Unexpected hub failure.", retryable: true },
};

export function hubError(code: HubErrorCode): HubError {
  return { success: false, error: { code, ...HUB_MESSAGES[code] } };
}

function playbackType(url: string | undefined): HubPlaybackType {
  if (!url) return "unknown";
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".m3u8")) return "hls";
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return "mp4";
  return "unknown";
}

function firstUrl(node: Rec, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = node[key];
    if (isSafeMediaUrl(value)) return value.trim();
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (isSafeMediaUrl(entry)) return entry.trim();
        if (isRec(entry) && isSafeMediaUrl(entry.url)) return String(entry.url).trim();
      }
    }
    if (isRec(value) && isSafeMediaUrl(value.url)) return String(value.url).trim();
  }
  return undefined;
}

export function normalizeHubVideo(raw: unknown, index: number): HubVideo | null {
  if (!isRec(raw)) return null;
  const title =
    str(pick(raw, ["title", "name", "caption", "headline"])) ?? "Untitled entry";
  const id =
    str(pick(raw, ["id", "video_id", "videoId", "uuid", "slug", "hash"])) ??
    `hub-${index}-${title.slice(0, 24).replace(/\W+/g, "-").toLowerCase()}`;

  const thumbnailRaw = pick(raw, [
    "thumbnail",
    "thumbnail_url",
    "thumbnailUrl",
    "thumb",
    "poster",
    "image",
    "cover",
    "preview",
    "thumbnails",
  ]);

  const thumbnailUrl = isRec(thumbnailRaw)
    ? firstUrl(thumbnailRaw, ["cover", "url", "src", "image"])
    : firstUrl(raw, [
        "thumbnail",
        "thumbnail_url",
        "thumbnailUrl",
        "thumb",
        "poster",
        "image",
        "cover",
        "preview",
        "thumbnails",
      ]);

  const streamUrl = firstUrl(raw, [
    "hls",
    "hls_url",
    "m3u8",
    "stream_url",
    "streamUrl",
    "playback_url",
    "playbackUrl",
    "video_url",
    "videoUrl",
    "src",
    "file",
    "sources",
  ]);
  const downloadUrl = firstUrl(raw, ["download_url", "downloadUrl", "download", "mp4"]);

  const durationSeconds = parseDurationSeconds(
    pick(raw, ["duration", "durationSeconds", "length", "duration_ms", "runtime"]),
  );
  const viewsRaw = pick(raw, ["views", "view_count", "viewCount", "plays"]);
  const views = num(viewsRaw);
  const viewsLabel =
    typeof viewsRaw === "string" && viewsRaw.trim()
      ? viewsRaw.trim()
      : undefined;

  const authorRaw = pick(raw, ["author", "channel", "uploader", "user", "creator"]);
  let author: HubVideo["author"];
  if (typeof authorRaw === "string" && authorRaw.trim()) {
    author = { name: authorRaw.trim() };
  } else if (isRec(authorRaw)) {
    author = {
      name: str(pick(authorRaw, ["name", "title", "username", "nickname"])),
      avatarUrl: firstUrl(authorRaw, ["avatar", "avatar_url", "image", "thumbnail"]),
      url: firstUrl(authorRaw, ["url", "link", "profile_url"]),
    };
    if (!author.name && !author.avatarUrl) author = undefined;
  }

  const tagsRaw = pick(raw, ["tags", "categories", "keywords"]);
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((t) => str(t)).filter((t): t is string => Boolean(t)).slice(0, 6)
    : [];

  const publishedRaw = pick(raw, ["publishedAt", "published_at", "created_at", "date", "upload_date"]);
  let publishedAt: string | undefined;
  const publishedNumber = num(publishedRaw);
  if (publishedNumber && publishedNumber > 1_000_000) {
    const ms = publishedNumber > 1e12 ? publishedNumber : publishedNumber * 1000;
    publishedAt = new Date(ms).toISOString();
  } else {
    const parsed = Date.parse(str(publishedRaw) ?? "");
    if (!Number.isNaN(parsed)) publishedAt = new Date(parsed).toISOString();
  }

  const needsResolve = !streamUrl;
  const video: HubVideo = {
    id,
    title,
    tags,
    playback: {
      url: streamUrl,
      type: playbackType(streamUrl),
      needsResolve,
    },
  };
  const description = str(pick(raw, ["description", "summary", "text"]));
  if (description) video.description = description;
  if (thumbnailUrl) video.thumbnailUrl = thumbnailUrl;
  const width = num(pick(raw, ["thumbnail_width", "width"]));
  const height = num(pick(raw, ["thumbnail_height", "height"]));
  if (width) video.thumbnailWidth = width;
  if (height) video.thumbnailHeight = height;
  if (durationSeconds && durationSeconds > 0) {
    video.durationSeconds = durationSeconds;
    video.durationLabel = formatDuration(durationSeconds);
  }
  if (author) video.author = author;
  if (views !== undefined) {
    video.views = views;
    video.viewsLabel = formatCount(views);
  } else if (viewsLabel) {
    video.viewsLabel = viewsLabel;
  }
  if (publishedAt) video.publishedAt = publishedAt;
  const sourceUrl = firstUrl(raw, [
    "url",
    "source_url",
    "sourceUrl",
    "page_url",
    "permalink",
    "link",
  ]);

  if (sourceUrl) video.sourceUrl = sourceUrl;
  if (downloadUrl) video.downloadUrl = downloadUrl;

  if (!video.thumbnailUrl && !video.playback.url && video.playback.needsResolve) {
    return null;
  }
  return video;
}

function collectItems(root: unknown): unknown[] | null {
  if (Array.isArray(root)) return root;
  if (!isRec(root)) return null;
  const keys = ["items", "videos", "results", "data", "list", "entries", "hits", "docs", "feed"];
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) return value;
    if (isRec(value)) {
      const nested = collectItems(value);
      if (nested) return nested;
    }
  }
  return null;
}

export function normalizeHubFeed(
  raw: unknown,
  ctx: { query: string; page: number },
): HubResponse {
  let payload = raw;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return hubError("MALFORMED_RESPONSE");
    }
  }
  if (payload === null || payload === undefined) return hubError("MALFORMED_RESPONSE");

  if (isRec(payload)) {
    const errText =
      str(pick(payload, ["error", "error_message", "message"])) ??
      (isRec(payload.error) ? str(pick(payload.error, ["message", "detail"])) : undefined);
    const explicitFailure =
      payload.success === false || payload.status === "error" || Boolean(payload.error);
    if (explicitFailure && errText) {
      if (/rate|quota|too many/i.test(errText)) return hubError("RATE_LIMITED");
      if (/not found|empty/i.test(errText)) return hubError("NOT_FOUND");
      if (/timeout|timed out/i.test(errText)) return hubError("TIMEOUT");
      return hubError("UPSTREAM_ERROR");
    }
  }

  const rawItems = collectItems(payload);
  if (!rawItems) return hubError("MALFORMED_RESPONSE");

  const items = rawItems
    .map((item, index) => normalizeHubVideo(item, index + ctx.page * 1000))
    .filter((item): item is HubVideo => item !== null);

  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  let hasMore = unique.length >= 12;

  if (isRec(payload)) {
    const data = isRec(payload.data) ? payload.data : undefined;

    const totalPages = num(
      data ? data.totalPages : undefined,
    );

    const currentPage = num(
      data ? data.page : undefined,
    );

    if (totalPages !== undefined && currentPage !== undefined) {
      hasMore = currentPage < totalPages;
    } else {
      hasMore = Boolean(
        payload.hasMore ??
          payload.has_more ??
          payload.next_page ??
          payload.nextPage ??
          hasMore,
      );
    }
  }

  return {
    success: true,
    query: ctx.query,
    page: ctx.page,
    hasMore,
    items: unique,
  };
}
