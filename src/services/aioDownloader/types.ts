export type SupportedPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "twitter"
  | "pinterest"
  | "threads"
  | "snapchat";

export type DownloadOption = {
  id: string;
  url: string;
  type: "video" | "audio" | "image";
  format?: string;
  mimeType?: string;
  quality?: string;
  qualityLabel?: string;
  resolution?: { width?: number; height?: number };
  fileSize?: number;
  fileSizeLabel?: string;
  hasAudio?: boolean;
  hasVideo?: boolean;
  expiresAt?: string;
  label: string;
};

export type NormalizedMedia = {
  id?: string;
  kind: "video" | "audio" | "image" | "carousel" | "unknown";
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  author?: {
    name?: string;
    username?: string;
    avatarUrl?: string;
    profileUrl?: string;
  };
  durationSeconds?: number;
  durationLabel?: string;
  publishedAt?: string;
};

export type NormalizedDownloadResult = {
  success: true;
  source: {
    url: string;
    platform: SupportedPlatform;
    platformLabel: string;
  };
  media: NormalizedMedia;
  options: DownloadOption[];
};

export type DownloadErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PLATFORM"
  | "PRIVATE_CONTENT"
  | "CONTENT_NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  | "MALFORMED_RESPONSE"
  | "NO_MEDIA"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export type NormalizedDownloadError = {
  success: false;
  error: {
    code: DownloadErrorCode;
    message: string;
    retryable: boolean;
  };
};

export type AioResponse = NormalizedDownloadResult | NormalizedDownloadError;
