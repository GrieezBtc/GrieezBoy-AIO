/**
 * Isolated mock upstream for the VIDEO HUB only.
 * Completely separate from the AIO downloader mock/adapter.
 */

const SOURCES = [
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    duration: 596,
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    duration: 653,
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    duration: 15,
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    duration: 15,
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    duration: 888,
  },
  { url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", duration: 634 },
];

const TOPICS = [
  "signal processing", "modular synthesis", "night drive", "server room",
  "analog film", "drone survey", "circuit bending", "terminal workflow",
  "cold storage", "rooftop timelapse", "mechanical keyboards", "neon alleys",
  "data center tour", "vector graphics", "field recording", "satellite pass",
  "retro hardware", "low light photography", "shader study", "pixel art",
  "ambient loops", "cassette rips", "network topology", "kernel debugging",
];

const CHANNELS = [
  "NULLWAVE", "ops.log", "patchbay.kid", "Analog Division", "GRID//NORTH",
  "coldboot", "Static Bureau", "HEXFIELD", "monolith.fm", "Trace Route",
];

function seeded(n: number): number {
  const x = Math.sin(n * 9973.13) * 10_000;
  return x - Math.floor(x);
}

export function mockHubUpstream(query: string, page: number, pageSize = 12): unknown {
  const normalizedQuery = query.trim().toLowerCase();
  const items: unknown[] = [];
  const start = page * pageSize;

  for (let i = 0; i < pageSize; i += 1) {
    const index = start + i;
    const r = seeded(index + 1);
    const source = SOURCES[index % SOURCES.length];
    const topic = TOPICS[Math.floor(r * TOPICS.length)];
    const channel = CHANNELS[index % CHANNELS.length];
    const title = normalizedQuery
      ? `${normalizedQuery} // ${topic} · unit ${index + 1}`
      : `${topic} · unit ${index + 1}`;
    items.push({
      id: `hub-${index}`,
      title: title.replace(/\b\w/g, (c) => c.toUpperCase()),
      description:
        "Archived capture from the hub index. Streamed directly, no re-encode.",
      thumbnail: `https://picsum.photos/seed/hub${index}/640/360`,
      thumbnail_width: 640,
      thumbnail_height: 360,
      duration: source.duration,
      views: Math.floor(r * 2_400_000) + 1200,
      channel: {
        name: channel,
        avatar: `https://picsum.photos/seed/ch${index % CHANNELS.length}/64/64`,
      },
      published_at: new Date(Date.now() - index * 7_200_000).toISOString(),
      tags: [topic.split(" ")[0], "archive", index % 3 === 0 ? "hls" : "mp4"],
      // Every 5th entry ships without a stream URL so the resolver path is used.
      ...(index % 5 === 4
        ? {}
        : { stream_url: source.url, download_url: source.url.endsWith(".m3u8") ? undefined : source.url }),
      source_url: source.url,
    });
  }

  if (normalizedQuery === "empty") {
    return { items: [], has_more: false };
  }

  return { items, has_more: page < 6, page };
}

export function mockHubResolve(id: string): unknown {
  const index = Number(id.replace(/\D/g, "")) || 0;
  const source = SOURCES[index % SOURCES.length];
  return {
    id,
    stream_url: source.url,
    download_url: source.url.endsWith(".m3u8") ? undefined : source.url,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  };
}
