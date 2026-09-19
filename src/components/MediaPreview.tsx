"use client";

import type { NormalizedDownloadResult } from "@/services/aioDownloader/types";
import { PLATFORM_MAP } from "@/services/aioDownloader/platforms";

const KIND_LABEL: Record<NormalizedDownloadResult["media"]["kind"], string> = {
  video: "Video",
  audio: "Audio",
  image: "Image",
  carousel: "Carousel",
  unknown: "Media",
};

export function MediaPreview({ result }: { result: NormalizedDownloadResult }) {
  const { media, source, options } = result;
  const platform = PLATFORM_MAP[source.platform];
  const facts: Array<{ label: string; value: string }> = [
    { label: "platform", value: platform.label },
    { label: "type", value: KIND_LABEL[media.kind] },
  ];
  if (media.durationLabel) facts.push({ label: "duration", value: media.durationLabel });
  facts.push({ label: "streams", value: String(options.length) });
  const best = options.find((option) => option.type === "video") ?? options[0];
  if (best?.qualityLabel) facts.push({ label: "max quality", value: best.qualityLabel });
  if (best?.format) facts.push({ label: "format", value: best.format.toUpperCase() });
  if (media.publishedAt) {
    facts.push({
      label: "published",
      value: new Date(media.publishedAt).toISOString().slice(0, 10),
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,300px)_1fr] lg:grid-cols-[minmax(0,360px)_1fr]">
      <figure className="relative m-0 overflow-hidden border border-line bg-[color-mix(in_srgb,var(--bg-deep)_80%,transparent)]">
        {media.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={media.thumbnailUrl}
            alt={media.title ? `Thumbnail for ${media.title}` : "Media thumbnail"}
            loading="lazy"
            decoding="async"
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center">
            <span className="t-label">no preview</span>
          </div>
        )}
        <figcaption
          className="absolute top-2 left-2 border px-2 py-1 text-[0.58rem] font-bold tracking-[0.18em] uppercase backdrop-blur-md"
          style={{
            borderColor: platform.accent,
            color: platform.accent,
            background: "color-mix(in srgb, var(--bg-deep) 70%, transparent)",
          }}
        >
          {platform.short} · {KIND_LABEL[media.kind]}
        </figcaption>
        {media.durationLabel ? (
          <span className="absolute right-2 bottom-2 border border-line bg-[color-mix(in_srgb,var(--bg-deep)_82%,transparent)] px-2 py-1 text-[0.62rem] tabular-nums">
            {media.durationLabel}
          </span>
        ) : null}
      </figure>

      <div className="min-w-0">
        <h3 className="text-[1rem] leading-snug font-bold text-balance sm:text-[1.15rem]">
          {media.title ?? "Untitled media"}
        </h3>

        {media.author?.name || media.author?.username ? (
          <div className="mt-2.5 flex items-center gap-2">
            {media.author.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={media.author.avatarUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-7 w-7 shrink-0 border border-line object-cover"
              />
            ) : null}
            <p className="min-w-0 truncate text-[0.78rem] text-dim">
              {media.author.name ?? media.author.username}
              {media.author.username && media.author.name ? (
                <span className="text-faint"> · @{media.author.username.replace(/^@/, "")}</span>
              ) : null}
            </p>
          </div>
        ) : null}

        {media.description ? (
          <p className="mt-3 line-clamp-3 max-w-2xl text-[0.76rem] leading-relaxed text-dim">
            {media.description}
          </p>
        ) : null}

        <dl className="mt-4 grid grid-cols-2 gap-px border border-line bg-[var(--line)] sm:grid-cols-3">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="bg-[color-mix(in_srgb,var(--panel-solid)_80%,transparent)] px-2.5 py-2"
            >
              <dt className="t-label text-[0.5rem]">{fact.label}</dt>
              <dd className="mt-1 truncate text-[0.74rem] font-medium">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
