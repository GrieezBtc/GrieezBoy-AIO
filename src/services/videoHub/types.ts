export type HubPlaybackType = "mp4" | "hls" | "unknown";

export type HubVideo = {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  durationSeconds?: number;
  durationLabel?: string;
  author?: { name?: string; avatarUrl?: string; url?: string };
  views?: number;
  viewsLabel?: string;
  publishedAt?: string;
  tags: string[];
  sourceUrl?: string;
  playback: {
    url?: string;
    type: HubPlaybackType;
    /** true when the stream URL must be fetched from the resolver route */
    needsResolve: boolean;
  };
  downloadUrl?: string;
};

export type HubFeed = {
  success: true;
  query: string;
  page: number;
  hasMore: boolean;
  items: HubVideo[];
};

export type HubErrorCode =
  | "BAD_QUERY"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  | "MALFORMED_RESPONSE"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export type HubError = {
  success: false;
  error: { code: HubErrorCode; message: string; retryable: boolean };
};

export type HubResponse = HubFeed | HubError;

export type HubResolved =
  | {
      success: true;
      id: string;
      playback: { url: string; type: HubPlaybackType };
      downloadUrl?: string;
      expiresAt?: string;
    }
  | HubError;
