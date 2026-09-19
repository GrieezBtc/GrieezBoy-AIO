import type { SupportedPlatform } from "./types";

/**
 * Isolated mock upstream. Shapes intentionally differ per platform so the
 * normalizer is exercised the same way the real RapidAPI payloads will be.
 * Swapping in the real API only requires the client to stop calling this.
 */

const SAMPLE_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const SAMPLE_VIDEO_SD =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
const SAMPLE_VIDEO_LOW =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";
const SAMPLE_AUDIO = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

const thumb = (seed: string, w = 800, h = 450) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

export function mockAioUpstream(
  url: string,
  platform: SupportedPlatform,
): unknown {
  switch (platform) {
    case "youtube":
      return {
        status: "ok",
        platform: "youtube",
        title: "Signal Decay — Full Live Set (4K)",
        description: "Recorded at Node 7. Modular synth session.",
        thumbnail: thumb("gbyt", 1280, 720),
        duration: 3187,
        channel: { name: "NULLWAVE", username: "@nullwave", url: "https://youtube.com/@nullwave" },
        publishedAt: "2025-11-04T18:20:00Z",
        formats: [
          { url: SAMPLE_VIDEO, quality_label: "1080p", ext: "mp4", mime: "video/mp4", width: 1920, height: 1080, contentLength: 158_432_112, hasAudio: true },
          { url: SAMPLE_VIDEO_SD, quality_label: "720p", ext: "mp4", mime: "video/mp4", width: 1280, height: 720, contentLength: 74_112_990, hasAudio: true },
          { url: SAMPLE_VIDEO_LOW, quality_label: "360p", ext: "mp4", mime: "video/mp4", width: 640, height: 360, contentLength: 21_884_771, hasAudio: true },
          { url: SAMPLE_AUDIO, quality: "128kbps", ext: "mp3", mime: "audio/mpeg", type: "audio", filesize: "5.4 MB" },
        ],
      };
    case "tiktok":
      return {
        code: 0,
        source: "tiktok",
        data: {
          id: "7300000000000000000",
          title: "how to route audio through a patchbay #synth",
          cover: thumb("gbtt", 720, 1280),
          duration: 42,
          author: { nickname: "patchbay.kid", unique_id: "patchbay.kid", avatar: thumb("gbttav", 128, 128) },
          create_time: 1_762_000_000,
          play: SAMPLE_VIDEO_SD,
          hdplay: SAMPLE_VIDEO,
          wmplay: SAMPLE_VIDEO_LOW,
          size: 4_982_331,
          hd_size: 12_774_221,
          music: { play_url: SAMPLE_AUDIO, title: "original sound" },
        },
      };
    case "instagram":
      return {
        success: true,
        platform: "instagram",
        result: {
          shortcode: "CxAbCdEfGhI",
          caption: "cold open // 35mm scans",
          thumbnail_url: thumb("gbig", 1080, 1080),
          owner: { full_name: "Analog Division", username: "analog.division", profile_pic_url: thumb("gbigav", 128, 128) },
          medias: [
            { url: SAMPLE_VIDEO, type: "video", quality: "1080p", extension: "mp4", size: "18.2 MB", height: 1080, width: 1080 },
            { url: `${thumb("gbig1", 1440, 1440)}.jpg`, type: "image", quality: "1440x1440", extension: "jpg" },
            { url: `${thumb("gbig2", 1440, 1440)}.jpg`, type: "image", quality: "1440x1440", extension: "jpg" },
          ],
          duration: 18.4,
        },
      };
    case "facebook":
      return {
        status: true,
        site: "facebook",
        title: "Warehouse rebuild — timelapse",
        thumbnail: thumb("gbfb", 1280, 720),
        duration_ms: 268_000,
        uploader_name: "Built By Hand",
        links: [
          { quality: "HD", url: SAMPLE_VIDEO, ext: "mp4", size: 41_221_004 },
          { quality: "SD", url: SAMPLE_VIDEO_SD, ext: "mp4", size: 12_004_112 },
        ],
      };
    case "twitter":
      return {
        platform: "x.com",
        text: "shipping the new build tonight. full thread below.",
        thumbnail: thumb("gbtw", 1280, 720),
        user: { name: "griz", screen_name: "grizbuilds", avatar_url: thumb("gbtwav", 128, 128) },
        created_at: "2025-12-20T09:41:00Z",
        media: [
          { variant: "1280x720", url: SAMPLE_VIDEO, content_type: "video/mp4", bitrate: 2_176_000, height: 720, width: 1280 },
          { variant: "640x360", url: SAMPLE_VIDEO_SD, content_type: "video/mp4", bitrate: 832_000, height: 360, width: 640 },
        ],
        duration: 74,
      };
    case "pinterest":
      return {
        provider: "pinterest",
        title: "Brutalist interior reference board",
        images: [
          `${thumb("gbpin1", 1200, 1600)}.jpg`,
          `${thumb("gbpin2", 1200, 1600)}.jpg`,
        ],
        thumbnail: thumb("gbpin1", 600, 800),
        author: { name: "concrete.notes" },
      };
    case "threads":
      return {
        service: "threads",
        post: {
          id: "CxAbCdEfGhI",
          caption: "test rig running for 72h straight, zero drops.",
          user: { name: "ops.log", username: "ops.log", avatar: thumb("gbthav", 128, 128) },
          thumbnail: thumb("gbth", 1080, 1350),
          taken_at: 1_764_000_000,
        },
        medias: [
          { url: SAMPLE_VIDEO, type: "video", quality: "720p", ext: "mp4", filesize: 9_112_040, expires: Math.floor(Date.now() / 1000) + 3600 },
          { url: `${thumb("gbth2", 1080, 1350)}.jpg`, type: "image", quality: "1080x1350", ext: "jpg" },
        ],
        duration: 31,
        source_url: url,
      };
    default:
      return { error: "unsupported" };
  }
}
