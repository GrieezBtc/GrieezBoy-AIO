import type {
  HubError,
  HubErrorCode,
  HubFeed,
  HubResponse,
  HubVideo,
} from "./types";

const HUB_MESSAGES: Record<
  HubErrorCode,
  { message: string; retryable: boolean }
> = {
  BAD_QUERY: {
    message: "Enter a valid search query.",
    retryable: false,
  },
  NOT_FOUND: {
    message: "No video results were found.",
    retryable: false,
  },
  RATE_LIMITED: {
    message: "The video service is temporarily rate limited.",
    retryable: true,
  },
  TIMEOUT: {
    message: "The video service took too long to respond.",
    retryable: true,
  },
  UPSTREAM_ERROR: {
    message: "The video service returned an error.",
    retryable: true,
  },
  MALFORMED_RESPONSE: {
    message: "The video service returned an unexpected response.",
    retryable: true,
  },
  NETWORK_ERROR: {
    message: "Unable to connect to the video service.",
    retryable: true,
  },
  UNKNOWN: {
    message: "Something went wrong while loading videos.",
    retryable: true,
  },
};

export function hubError(code: HubErrorCode): HubError {
  return {
    success: false,
    error: {
      code,
      message: HUB_MESSAGES[code].message,
      retryable: HUB_MESSAGES[code].retryable,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function formatViews(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return String(value);
}

function parseDuration(value: unknown): number | undefined {
  const raw = asString(value);

  if (!raw) return undefined;

  const match = raw.match(
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i,
  );

  if (!match) return undefined;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remaining,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

function normalizeItem(
  raw: unknown,
  fallbackIndex: number,
): HubVideo | null {
  const item = asRecord(raw);

  if (!item) return null;

  const idObject = asRecord(item.id);
  const snippet = asRecord(item.snippet);
  const statistics = asRecord(item.statistics);
  const contentDetails = asRecord(item.contentDetails);

  /*
   * search.list returns:
   *   id.videoId
   *
   * videos.list returns:
   *   id
   */
  const id =
    asString(idObject?.videoId) ??
    asString(item.id);

  if (!id) return null;

  const title =
    asString(snippet?.title) ??
    `YouTube video ${fallbackIndex + 1}`;

  const thumbnails = asRecord(snippet?.thumbnails);
  const highThumbnail = asRecord(thumbnails?.high);
  const mediumThumbnail = asRecord(thumbnails?.medium);
  const defaultThumbnail = asRecord(thumbnails?.default);

  const thumbnail =
    asString(highThumbnail?.url) ??
    asString(mediumThumbnail?.url) ??
    asString(defaultThumbnail?.url);

  const views = asNumber(statistics?.viewCount);
  const durationSeconds = parseDuration(contentDetails?.duration);

  const publishedAt = asString(snippet?.publishedAt);
  const channelTitle = asString(snippet?.channelTitle);
  const channelId = asString(snippet?.channelId);

  return {
    id,
    title,
    description: asString(snippet?.description),
    thumbnailUrl: thumbnail,
    thumbnailWidth: asNumber(highThumbnail?.width),
    thumbnailHeight: asNumber(highThumbnail?.height),
    durationSeconds,
    durationLabel: formatDuration(durationSeconds),
    author: channelTitle
      ? {
          name: channelTitle,
          url: channelId
            ? `https://www.youtube.com/channel/${encodeURIComponent(
                channelId,
              )}`
            : undefined,
        }
      : undefined,
    views,
    viewsLabel: formatViews(views),
    publishedAt,
    tags: Array.isArray(snippet?.tags)
      ? snippet.tags.filter(
          (tag): tag is string => typeof tag === "string",
        )
      : [],
    sourceUrl: youtubeWatchUrl(id),
    playback: {
      type: "unknown",
      needsResolve: false,
    },
  };
}

export function normalizeHubVideo(
  payload: unknown,
  fallbackIndex = 0,
): HubVideo | null {
  return normalizeItem(payload, fallbackIndex);
}

export function normalizeHubFeed(
  payload: unknown,
  context: {
    query: string;
    page: number;
  },
): HubResponse {
  const root = asRecord(payload);

  if (!root) {
    return hubError("MALFORMED_RESPONSE");
  }

  const rawItems = Array.isArray(root.items) ? root.items : [];

  const items = rawItems
    .map((item, index) => normalizeItem(item, index))
    .filter((item): item is HubVideo => item !== null);

  if (rawItems.length > 0 && items.length === 0) {
    return hubError("MALFORMED_RESPONSE");
  }

  const nextPageToken = asString(root.nextPageToken);

  const feed: HubFeed = {
    success: true,
    query: context.query,
    page: context.page,
    hasMore: Boolean(nextPageToken),
    items,
  };

  return feed;
}
