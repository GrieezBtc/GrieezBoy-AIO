import {
  formatBytes,
  formatDuration,
  parseDurationSeconds,
  parseFileSize,
} from "@/lib/format";
import { codeFromUpstreamText, downloadError } from "./errors";
import {
  detectPlatform,
  isSafeMediaUrl,
  normalizePlatformName,
  platformLabel,
} from "./platforms";
import type {
  AioResponse,
  DownloadOption,
  NormalizedMedia,
  SupportedPlatform,
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
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) {
    return Number(v.trim());
  }
  return undefined;
};

const pick = (node: Rec, keys: string[]): unknown => {
  for (const key of keys) {
    const value = node[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

/* ------------------------------------------------------------------ *
 * URL candidate harvesting
 * ------------------------------------------------------------------ */

const STRONG_URL_KEYS = [
  "download_url",
  "downloadUrl",
  "download_link",
  "downloadLink",
  "dlink",
  "video_url",
  "videoUrl",
  "audio_url",
  "audioUrl",
  "media_url",
  "mediaUrl",
  "play",
  "playAddr",
  "play_addr",
  "hdplay",
  "hd_play",
  "wmplay",
  "nwm_video_url",
  "file",
  "video",
  "audio",
  "hd",
  "sd",
  "mp4",
  "mp3",
];

const WEAK_URL_KEYS = ["url", "link", "src", "source", "href", "uri", "address"];

const EXCLUDED_KEY =
  /thumb|cover|avatar|poster|preview|profile|icon|logo|banner|display_url|picture|photo_url_small|origin_cover|source_url|sourceurl|page_url|permalink|share|embed|canonical|web_url|post_url/i;

const STRING_MEDIA_KEYS =
  /^(urls?|links?|medias?|images?|photos?|videos?|audios?|files?|downloads?|items?|formats?|sources?|resources?|hd|sd|mp4|mp3|video|audio|image)$/i;

const EXTRA_STRING_KEYS = /(^|_)(play|download|stream|nwm)|play(_?addr|_?url)?$|_url$|_link$/i;

/** Hints derived literally from the key name (never invented values). */
const KEY_HINTS: Array<[RegExp, { quality?: string; sizeKeys?: string[] }]> = [
  [/^(hd|hdplay|hd_play|hd_url|video_hd|hd_video_url)$/i, { quality: "HD", sizeKeys: ["hd_size", "hdSize", "size_hd"] }],
  [/^(sd|sdplay|sd_url|video_sd)$/i, { quality: "SD", sizeKeys: ["sd_size", "sdSize"] }],
  [/^(wmplay|wm_video_url|watermark)$/i, { quality: "Watermarked", sizeKeys: ["wm_size", "wmSize"] }],
  [/^(nwm_video_url|nowatermark|no_watermark)$/i, { quality: "No watermark", sizeKeys: ["nwm_size"] }],
];

function hintsForKey(key: string): { quality?: string; sizeKeys?: string[] } {
  for (const [pattern, hint] of KEY_HINTS) {
    if (pattern.test(key)) return hint;
  }
  return {};
}

type Candidate = {
  url: string;
  node: Rec;
  key: string;
  parentKey?: string;
  /** true when the parent record exposed several media URLs */
  shared?: boolean;
};

/** Collects every media URL a single record exposes (hd + sd + audio, ...). */
function findUrlsInRecord(
  node: Rec,
  depth: number,
): Array<{ url: string; key: string }> {
  const found: Array<{ url: string; key: string }> = [];
  const seen = new Set<string>();
  for (const key of STRONG_URL_KEYS) {
    if (EXCLUDED_KEY.test(key)) continue;
    const value = node[key];
    if (isSafeMediaUrl(value) && !seen.has(value.trim())) {
      seen.add(value.trim());
      found.push({ url: value.trim(), key });
    }
  }
  if (!found.length && depth >= 1) {
    for (const key of WEAK_URL_KEYS) {
      const value = node[key];
      if (isSafeMediaUrl(value)) {
        found.push({ url: value.trim(), key });
        break;
      }
    }
  }
  return found;
}

function harvest(
  node: unknown,
  depth: number,
  key: string,
  out: Candidate[],
): void {
  if (depth > 7 || out.length > 200) return;
  if (Array.isArray(node)) {
    for (const item of node) harvest(item, depth + 1, key, out);
    return;
  }
  if (typeof node === "string") {
    if (
      depth >= 1 &&
      isSafeMediaUrl(node) &&
      !EXCLUDED_KEY.test(key) &&
      (STRING_MEDIA_KEYS.test(key) || EXTRA_STRING_KEYS.test(key))
    ) {
      out.push({ url: node.trim(), node: {}, key });
    }
    return;
  }
  if (!isRec(node)) return;

  const found = EXCLUDED_KEY.test(key) ? [] : findUrlsInRecord(node, depth);
  const shared = found.length > 1;
  for (const entry of found) {
    out.push({ url: entry.url, node, key: entry.key, parentKey: key, shared });
  }

  const consumed = new Set(found.map((entry) => entry.key));
  for (const [childKey, value] of Object.entries(node)) {
    if (consumed.has(childKey)) continue;
    if (EXCLUDED_KEY.test(childKey)) continue;
    harvest(value, depth + 1, childKey, out);
  }
}

/* ------------------------------------------------------------------ *
 * Option building
 * ------------------------------------------------------------------ */

const VIDEO_EXT = /\.(mp4|m4v|webm|mov|mkv|avi|3gp|ts|m3u8|mpd)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|opus|ogg|oga|wav|flac)(\?|#|$)/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|heic|bmp|avif)(\?|#|$)/i;

function inferType(
  candidate: Candidate,
): { type: DownloadOption["type"]; confident: boolean } {
  const { node, url, key, parentKey } = candidate;
  const explicit = [
    str(node.type),
    str(node.mediaType),
    str(node.media_type),
    str(node.kind),
    str(node.category),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const mime = (str(pick(node, ["mime", "mimeType", "mime_type", "content_type", "contentType"])) ?? "").toLowerCase();
  const hay = `${explicit} ${mime}`;

  if (/audio|music|sound|mp3/.test(hay)) return { type: "audio", confident: true };
  if (/image|photo|picture|jpeg|jpg|png|webp|gif/.test(hay)) {
    return { type: "image", confident: true };
  }
  if (/video|mp4|webm/.test(hay)) return { type: "video", confident: true };

  const path = url.split("?")[0];
  if (AUDIO_EXT.test(path)) return { type: "audio", confident: true };
  if (IMAGE_EXT.test(path)) return { type: "image", confident: true };
  if (VIDEO_EXT.test(path)) return { type: "video", confident: true };

  const keyHay = `${key} ${parentKey ?? ""}`.toLowerCase();
  if (/audio|mp3|music/.test(keyHay)) return { type: "audio", confident: true };
  if (/image|photo|picture/.test(keyHay)) return { type: "image", confident: true };
  if (/video|mp4|play|hd|sd/.test(keyHay)) return { type: "video", confident: true };

  const label = (str(pick(node, ["quality", "qualityLabel", "quality_label", "label", "format", "ext"])) ?? "").toLowerCase();
  if (/audio|kbps/.test(label)) return { type: "audio", confident: true };
  if (/\d{3,4}p|\dk|hd|sd/.test(label)) return { type: "video", confident: true };

  return { type: "video", confident: false };
}

function extFromUrl(url: string): string | undefined {
  const path = url.split(/[?#]/)[0];
  const match = path.match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : undefined;
}

function readResolution(node: Rec): { width?: number; height?: number } | undefined {
  const width = num(pick(node, ["width", "video_width", "w"]));
  const height = num(pick(node, ["height", "video_height", "h"]));
  if (width || height) return { width, height };
  const res = pick(node, ["resolution", "size", "dimensions"]);
  if (isRec(res)) {
    const w = num(res.width);
    const h = num(res.height);
    if (w || h) return { width: w, height: h };
  }
  const resStr = str(res);
  if (resStr) {
    const m = resStr.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/);
    if (m) return { width: Number(m[1]), height: Number(m[2]) };
  }
  return undefined;
}

function readExpiry(node: Rec): string | undefined {
  const raw = pick(node, [
    "expiresAt",
    "expires_at",
    "expire",
    "expires",
    "expiry",
    "expire_at",
    "valid_until",
  ]);
  const asNumber = num(raw);
  if (asNumber && asNumber > 0) {
    const ms = asNumber > 1e12 ? asNumber : asNumber * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    return undefined;
  }
  const asString = str(raw);
  if (asString) {
    const parsed = Date.parse(asString);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return undefined;
}

function qualityHeight(option: {
  quality?: string;
  qualityLabel?: string;
  resolution?: { width?: number; height?: number };
}): number {
  if (option.resolution?.height) return option.resolution.height;
  const text = `${option.qualityLabel ?? ""} ${option.quality ?? ""}`.toLowerCase();
  const p = text.match(/(\d{3,4})\s*p/);
  if (p) return Number(p[1]);
  const k = text.match(/(\d)\s*k\b/);
  if (k) return Number(k[1]) * 1080;
  if (/\bhd\b|high/.test(text)) return 720;
  if (/\bsd\b|low/.test(text)) return 360;
  const bare = text.match(/(\d{3,4})/);
  if (bare) return Number(bare[1]);
  return 0;
}

function hashId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function buildOption(candidate: Candidate): DownloadOption | null {
  const { node, url } = candidate;
  if (!isSafeMediaUrl(url)) return null;

  const { type } = inferType(candidate);
  const hint = hintsForKey(candidate.key);

  const nodeQuality = str(
    pick(node, ["qualityLabel", "quality_label", "quality", "label", "res", "definition", "bitrate_label"]),
  );
  const qualityRaw = candidate.shared
    ? (hint.quality ?? nodeQuality)
    : (nodeQuality ?? hint.quality);
  const resolution = readResolution(node);
  const heightLabel = resolution?.height ? `${resolution.height}p` : undefined;
  const quality = qualityRaw ?? heightLabel;
  const qualityLabel = qualityRaw ?? heightLabel;

  const formatRaw =
    str(pick(node, ["ext", "extension", "format", "container", "file_type", "fileType"])) ??
    extFromUrl(url);
  const format =
    formatRaw && /^[a-z0-9]{2,5}$/i.test(formatRaw) ? formatRaw.toLowerCase() : undefined;

  const mimeCandidate = str(
    pick(node, ["mime", "mimeType", "mime_type", "content_type", "contentType"]),
  );
  const mimeType = mimeCandidate?.includes("/") ? mimeCandidate : undefined;

  const genericSize = parseFileSize(
    pick(node, [
      "fileSize",
      "filesize",
      "file_size",
      "size_bytes",
      "contentLength",
      "content_length",
      "bytes",
      "size",
    ]),
  );
  const fileSize = hint.sizeKeys
    ? parseFileSize(pick(node, hint.sizeKeys))
    : genericSize;
  const rawSizeLabel = str(
    pick(node, ["fileSizeLabel", "size_label", "filesizeF", "sizeText", "formattedSize"]),
  );
  const fileSizeLabel =
    rawSizeLabel ?? (fileSize ? formatBytes(fileSize) : undefined);

  let hasAudio: boolean | undefined;
  let hasVideo: boolean | undefined;
  const audioFlag = pick(node, ["hasAudio", "has_audio", "audio", "with_audio"]);
  const videoFlag = pick(node, ["hasVideo", "has_video", "video"]);
  if (typeof audioFlag === "boolean") hasAudio = audioFlag;
  if (typeof videoFlag === "boolean") hasVideo = videoFlag;
  if (node.mute === true || node.muted === true) hasAudio = false;
  const labelHay = `${qualityRaw ?? ""} ${str(node.note) ?? ""} ${str(node.label) ?? ""}`.toLowerCase();
  if (/video only|no audio|muted|silent/.test(labelHay)) {
    hasAudio = false;
    hasVideo = true;
  }
  if (/audio only/.test(labelHay)) {
    hasAudio = true;
    hasVideo = false;
  }
  if (type === "audio") {
    hasAudio = hasAudio ?? true;
    hasVideo = hasVideo ?? false;
  }
  if (type === "image") {
    hasAudio = undefined;
    hasVideo = undefined;
  }

  const expiresAt = readExpiry(node);

  const labelParts: string[] = [];
  if (type === "video") {
    labelParts.push((qualityLabel ?? "VIDEO").toUpperCase());
  } else if (type === "audio") {
    labelParts.push(qualityLabel ? `AUDIO ${qualityLabel.toUpperCase()}` : "AUDIO");
  } else {
    labelParts.push(qualityLabel ? `IMAGE ${qualityLabel.toUpperCase()}` : "IMAGE");
  }
  if (format) labelParts.push(format.toUpperCase());
  if (fileSizeLabel) labelParts.push(fileSizeLabel);
  if (hasAudio === false && type === "video") labelParts.push("NO AUDIO");

  const option: DownloadOption = {
    id: `${type}-${hashId(`${url}|${quality ?? ""}|${format ?? ""}`)}`,
    url: url.trim(),
    type,
    label: labelParts.join(" · "),
  };
  if (format) option.format = format;
  if (mimeType) option.mimeType = mimeType;
  if (quality) option.quality = quality;
  if (qualityLabel) option.qualityLabel = qualityLabel;
  if (resolution) option.resolution = resolution;
  if (fileSize) option.fileSize = fileSize;
  if (fileSizeLabel) option.fileSizeLabel = fileSizeLabel;
  if (hasAudio !== undefined) option.hasAudio = hasAudio;
  if (hasVideo !== undefined) option.hasVideo = hasVideo;
  if (expiresAt) option.expiresAt = expiresAt;
  return option;
}

const TYPE_RANK: Record<DownloadOption["type"], number> = {
  video: 0,
  audio: 1,
  image: 2,
};

function sortOptions(options: DownloadOption[]): DownloadOption[] {
  return [...options].sort((a, b) => {
    if (TYPE_RANK[a.type] !== TYPE_RANK[b.type]) {
      return TYPE_RANK[a.type] - TYPE_RANK[b.type];
    }
    const ha = qualityHeight(a);
    const hb = qualityHeight(b);
    if (ha !== hb) return hb - ha;
    const sa = a.fileSize ?? 0;
    const sb = b.fileSize ?? 0;
    if (sa !== sb) return sb - sa;
    return a.url.localeCompare(b.url);
  });
}

function dedupe(options: DownloadOption[]): DownloadOption[] {
  const seenUrl = new Set<string>();
  const seenId = new Set<string>();
  const result: DownloadOption[] = [];
  for (const option of options) {
    const key = option.url.trim();
    if (seenUrl.has(key)) continue;
    seenUrl.add(key);
    let id = option.id;
    let suffix = 1;
    while (seenId.has(id)) {
      id = `${option.id}-${suffix}`;
      suffix += 1;
    }
    seenId.add(id);
    result.push({ ...option, id });
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * Metadata
 * ------------------------------------------------------------------ */

const META_CONTAINERS = [
  "data",
  "result",
  "results",
  "media",
  "meta",
  "metadata",
  "info",
  "item",
  "post",
  "detail",
  "details",
  "aweme_detail",
  "video_info",
  "videoDetails",
];

function metaNodes(root: Rec): Rec[] {
  const nodes: Rec[] = [root];
  for (const key of META_CONTAINERS) {
    const value = root[key];
    if (isRec(value)) {
      nodes.push(value);
      for (const inner of META_CONTAINERS) {
        const nested = value[inner];
        if (isRec(nested)) nodes.push(nested);
      }
    } else if (Array.isArray(value) && isRec(value[0])) {
      nodes.push(value[0] as Rec);
    }
  }
  return nodes;
}

function firstString(nodes: Rec[], keys: string[]): string | undefined {
  for (const node of nodes) {
    const value = str(pick(node, keys));
    if (value) return value;
  }
  return undefined;
}

function firstUrl(nodes: Rec[], keys: string[]): string | undefined {
  for (const node of nodes) {
    for (const key of keys) {
      const value = node[key];
      if (isSafeMediaUrl(value)) return value.trim();
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (isSafeMediaUrl(entry)) return entry.trim();
          if (isRec(entry) && isSafeMediaUrl(entry.url)) return String(entry.url).trim();
        }
      }
      if (isRec(value)) {
        const nested = pick(value, ["url", "url_list", "src", "link"]);
        if (isSafeMediaUrl(nested)) return nested.trim();
        if (Array.isArray(nested) && isSafeMediaUrl(nested[0])) {
          return String(nested[0]).trim();
        }
      }
    }
  }
  return undefined;
}

function readAuthor(nodes: Rec[]): NormalizedMedia["author"] | undefined {
  const keys = ["author", "uploader", "owner", "user", "channel", "creator", "account"];
  for (const node of nodes) {
    for (const key of keys) {
      const value = node[key];
      if (typeof value === "string" && value.trim()) {
        return { name: value.trim() };
      }
      if (isRec(value)) {
        const name = str(pick(value, ["name", "nickname", "full_name", "fullname", "title", "display_name"]));
        const username = str(pick(value, ["username", "unique_id", "uniqueId", "screen_name", "handle", "id"]));
        const avatarUrl = firstUrl([value], ["avatar", "avatar_url", "avatarUrl", "profile_pic_url", "avatarThumb", "avatar_thumb", "thumbnail", "image"]);
        const profileUrl = firstUrl([value], ["url", "profile_url", "link", "profileUrl"]);
        if (name || username || avatarUrl || profileUrl) {
          const author: NonNullable<NormalizedMedia["author"]> = {};
          if (name) author.name = name;
          if (username) author.username = username;
          if (avatarUrl) author.avatarUrl = avatarUrl;
          if (profileUrl) author.profileUrl = profileUrl;
          return author;
        }
      }
    }
    const flatName = str(pick(node, ["author_name", "authorName", "uploader_name", "channelName", "channel_name", "username", "nickname"]));
    if (flatName) {
      const username = str(pick(node, ["username", "unique_id", "screen_name"]));
      return username && username !== flatName
        ? { name: flatName, username }
        : { name: flatName };
    }
  }
  return undefined;
}

function readPublishedAt(nodes: Rec[]): string | undefined {
  const raw = (() => {
    for (const node of nodes) {
      const value = pick(node, [
        "publishedAt",
        "published_at",
        "publishDate",
        "createTime",
        "create_time",
        "created_at",
        "taken_at",
        "upload_date",
        "date",
        "timestamp",
      ]);
      if (value !== undefined) return value;
    }
    return undefined;
  })();
  const asNumber = num(raw);
  if (asNumber && asNumber > 1_000_000) {
    const ms = asNumber > 1e12 ? asNumber : asNumber * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const asString = str(raw);
  if (asString) {
    const iso = /^\d{8}$/.test(asString)
      ? `${asString.slice(0, 4)}-${asString.slice(4, 6)}-${asString.slice(6, 8)}`
      : asString;
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return undefined;
}

function deriveKind(options: DownloadOption[]): NormalizedMedia["kind"] {
  if (!options.length) return "unknown";
  const videos = options.filter((o) => o.type === "video");
  const images = options.filter((o) => o.type === "image");
  const audios = options.filter((o) => o.type === "audio");
  if (videos.length) return "video";
  if (images.length > 1) return "carousel";
  if (images.length === 1) return "image";
  if (audios.length) return "audio";
  return "unknown";
}

/* ------------------------------------------------------------------ *
 * Upstream error detection
 * ------------------------------------------------------------------ */

function detectUpstreamError(root: Rec): string | null {
  const errorValue = pick(root, ["error", "err", "errors", "error_message", "errorMessage", "detail", "reason"]);
  const statusText = str(pick(root, ["status", "state", "result_status"]))?.toLowerCase();
  const successFlag = root.success ?? root.ok ?? root.isSuccess;
  const statusCode = num(pick(root, ["status_code", "statusCode", "code", "http_code"]));

  const failing =
    (typeof successFlag === "boolean" && successFlag === false) ||
    (statusText !== undefined && /^(error|fail|failed|ko)$/.test(statusText)) ||
    (errorValue !== undefined && errorValue !== false && errorValue !== null && errorValue !== "") ||
    (statusCode !== undefined && statusCode >= 400);

  if (!failing) return null;

  const messageBits = [
    typeof errorValue === "string" ? errorValue : undefined,
    isRec(errorValue) ? str(pick(errorValue, ["message", "msg", "detail", "reason", "code"])) : undefined,
    Array.isArray(errorValue) ? errorValue.map((e) => (typeof e === "string" ? e : "")).join(" ") : undefined,
    str(pick(root, ["message", "msg", "detail", "reason"])),
    statusCode !== undefined ? `http ${statusCode}` : undefined,
  ].filter(Boolean);

  return messageBits.join(" ") || "upstream failure";
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export type NormalizeContext = {
  /** the URL the user submitted */
  url: string;
  /** optional platform hint from the caller */
  platform?: SupportedPlatform;
  /** http status returned by the upstream, when known */
  httpStatus?: number;
};

export function normalizeAioResponse(
  raw: unknown,
  ctx: NormalizeContext,
): AioResponse {
  let payload = raw;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return downloadError("MALFORMED_RESPONSE");
    }
  }
  if (Array.isArray(payload)) {
    payload = { medias: payload };
  }
  if (!isRec(payload)) return downloadError("MALFORMED_RESPONSE");

  const root = payload;

  const upstreamMessage = detectUpstreamError(root);
  if (upstreamMessage) {
    // Raw upstream text is only used to classify - never surfaced verbatim.
    return downloadError(codeFromUpstreamText(upstreamMessage));
  }

  const platform =
    normalizePlatformName(
      pick(root, ["platform", "source", "site", "service", "provider", "host", "type_name"]),
    ) ??
    ctx.platform ??
    detectPlatform(ctx.url) ??
    undefined;

  if (!platform) return downloadError("UNSUPPORTED_PLATFORM");

  const candidates: Candidate[] = [];
  harvest(root, 0, "$root", candidates);

  const options = dedupe(
    sortOptions(
      candidates
        .map(buildOption)
        .filter((option): option is DownloadOption => option !== null),
    ),
  );

  if (!options.length) {
    // A structurally valid payload with zero usable media.
    const looksLikePayload =
      Object.keys(root).length > 0 &&
      metaNodes(root).some(
        (node) =>
          str(pick(node, ["title", "caption", "description", "id"])) !== undefined,
      );
    return downloadError(looksLikePayload ? "NO_MEDIA" : "MALFORMED_RESPONSE");
  }

  const nodes = metaNodes(root);
  const title = firstString(nodes, ["title", "caption", "name", "text", "full_title", "desc"]);
  const description = firstString(nodes, ["description", "summary", "content"]);
  const thumbnailUrl = firstUrl(nodes, [
    "thumbnail",
    "thumbnail_url",
    "thumbnailUrl",
    "thumb",
    "cover",
    "origin_cover",
    "image",
    "picture",
    "poster",
    "display_url",
    "thumbnails",
    "covers",
  ]);
  const durationSeconds = parseDurationSeconds(
    (() => {
      for (const node of nodes) {
        const value = pick(node, [
          "durationSeconds",
          "duration_seconds",
          "duration",
          "lengthSeconds",
          "length_seconds",
          "length",
          "video_duration",
          "duration_ms",
        ]);
        if (value !== undefined) {
          if (
            typeof value === "number" &&
            (node.duration_ms !== undefined || value > 86_400)
          ) {
            return Math.round(value / 1000);
          }
          return value;
        }
      }
      return undefined;
    })(),
  );

  const media: NormalizedMedia = { kind: deriveKind(options) };
  const id = firstString(nodes, ["id", "media_id", "video_id", "aweme_id", "shortcode"]);
  if (id) media.id = id;
  if (title) media.title = title;
  if (description && description !== title) media.description = description;
  if (thumbnailUrl) media.thumbnailUrl = thumbnailUrl;
  const author = readAuthor(nodes);
  if (author) media.author = author;
  if (durationSeconds !== undefined && durationSeconds > 0) {
    media.durationSeconds = durationSeconds;
    media.durationLabel = formatDuration(durationSeconds);
  }
  const publishedAt = readPublishedAt(nodes);
  if (publishedAt) media.publishedAt = publishedAt;

  return {
    success: true,
    source: {
      url: ctx.url,
      platform,
      platformLabel: platformLabel(platform),
    },
    media,
    options,
  };
}
