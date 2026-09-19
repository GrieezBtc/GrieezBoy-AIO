import type { DownloadErrorCode, NormalizedDownloadError } from "./types";

type ErrorSpec = { message: string; retryable: boolean };

/**
 * User-facing copy. Raw upstream errors are NEVER surfaced; they are mapped
 * onto this fixed table first.
 */
export const ERROR_CATALOG: Record<DownloadErrorCode, ErrorSpec> = {
  INVALID_URL: {
    message: "The URL doesn't appear to belong to a supported platform.",
    retryable: false,
  },
  UNSUPPORTED_PLATFORM: {
    message:
      "That source isn't supported yet. Supported: YouTube, TikTok, Instagram, Facebook, X, Pinterest, Threads.",
    retryable: false,
  },
  PRIVATE_CONTENT: {
    message:
      "This content is private or restricted. Only publicly accessible media can be processed.",
    retryable: false,
  },
  CONTENT_NOT_FOUND: {
    message: "Nothing was found at that address. It may have been deleted.",
    retryable: false,
  },
  RATE_LIMITED: {
    message: "Too many requests right now. Wait a few seconds and re-execute.",
    retryable: true,
  },
  TIMEOUT: {
    message: "The engine timed out while resolving this media. Try again.",
    retryable: true,
  },
  UPSTREAM_ERROR: {
    message: "The media engine is temporarily unavailable. Try again shortly.",
    retryable: true,
  },
  MALFORMED_RESPONSE: {
    message: "The engine returned an unreadable payload for this link.",
    retryable: true,
  },
  NO_MEDIA: {
    message: "No downloadable media was found on that page.",
    retryable: false,
  },
  NETWORK_ERROR: {
    message: "Network connection to the media engine failed.",
    retryable: true,
  },
  UNKNOWN: {
    message: "Something went wrong while processing that link.",
    retryable: true,
  },
};

export const ERROR_TITLES: Record<DownloadErrorCode, string> = {
  INVALID_URL: "INVALID URL",
  UNSUPPORTED_PLATFORM: "UNSUPPORTED PLATFORM",
  PRIVATE_CONTENT: "PRIVATE CONTENT",
  CONTENT_NOT_FOUND: "CONTENT NOT FOUND",
  RATE_LIMITED: "RATE LIMITED",
  TIMEOUT: "REQUEST TIMEOUT",
  UPSTREAM_ERROR: "UPSTREAM FAILURE",
  MALFORMED_RESPONSE: "MALFORMED RESPONSE",
  NO_MEDIA: "NO MEDIA",
  NETWORK_ERROR: "NETWORK ERROR",
  UNKNOWN: "UNKNOWN ERROR",
};

export function downloadError(
  code: DownloadErrorCode,
  overrideMessage?: string,
): NormalizedDownloadError {
  const spec = ERROR_CATALOG[code];
  return {
    success: false,
    error: {
      code,
      message: overrideMessage ?? spec.message,
      retryable: spec.retryable,
    },
  };
}

/** Maps an HTTP status from the upstream provider onto a safe error code. */
export function codeFromHttpStatus(status: number): DownloadErrorCode {
  if (status === 400) return "INVALID_URL";
  if (status === 401 || status === 403) return "PRIVATE_CONTENT";
  if (status === 404 || status === 410) return "CONTENT_NOT_FOUND";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "UPSTREAM_ERROR";
  return "UPSTREAM_ERROR";
}

const TEXT_PATTERNS: Array<[RegExp, DownloadErrorCode]> = [
  [/\b(private|restricted|login required|sign in|age.?restricted|protected)\b/i, "PRIVATE_CONTENT"],
  [/\b(not found|unavailable|deleted|removed|does not exist|no such)\b/i, "CONTENT_NOT_FOUND"],
  [/\b(rate.?limit|too many requests|quota|throttl)\b/i, "RATE_LIMITED"],
  [/\b(timed? ?out|timeout|deadline)\b/i, "TIMEOUT"],
  [/\b(invalid url|bad url|malformed url|unsupported url)\b/i, "INVALID_URL"],
  [/\b(unsupported|not supported)\b/i, "UNSUPPORTED_PLATFORM"],
  [/\b(no media|nothing to download|empty result)\b/i, "NO_MEDIA"],
];

/** Maps an arbitrary upstream error string onto a safe internal code. */
export function codeFromUpstreamText(text: string): DownloadErrorCode {
  for (const [pattern, code] of TEXT_PATTERNS) {
    if (pattern.test(text)) return code;
  }
  return "UPSTREAM_ERROR";
}
