"use client";

import { triggerMediaDownload } from "@/lib/mediaDownload";
import type {
  DownloadOption,
  NormalizedMediaItem,
} from "@/services/aioDownloader/types";
import { useState } from "react";

function optionLabel(option: DownloadOption) {
  return (
    option.qualityLabel ??
    option.quality ??
    option.label ??
    option.format?.toUpperCase() ??
    "Download"
  );
}

function MediaVisual({ item }: { item: NormalizedMediaItem }) {
  const preview = item.thumbnailUrl ?? item.previewUrl;

  if (item.kind === "video" && item.previewUrl && !item.thumbnailUrl) {
    return (
      <video
        src={item.previewUrl}
        controls
        preload="metadata"
        className="h-full w-full object-cover"
      />
    );
  }

  if (preview) {
    return (
      <img
        src={preview}
        alt={item.label ?? "Media preview"}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <div className="grid h-full min-h-48 place-items-center">
      <span className="t-label">no preview</span>
    </div>
  );
}

function MediaCard({
  item,
  title,
}: {
  item: NormalizedMediaItem;
  title?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const primary =
    item.options.find((option) => option.type === item.kind) ??
    item.options.find((option) => option.type === "video") ??
    item.options[0];

  function download(option: DownloadOption) {
    setDownloading(true);

    try {
      triggerMediaDownload(option, title);
    } finally {
      window.setTimeout(() => setDownloading(false), 700);
    }
  }

  return (
    <article className="overflow-hidden border border-line bg-[color-mix(in_srgb,var(--panel-solid)_80%,transparent)]">
      <div className="relative aspect-video overflow-hidden bg-[var(--bg-deep)]">
        <MediaVisual item={item} />

        <div
          className="absolute left-2 top-2 border px-2 py-1 text-[0.52rem] font-bold tracking-[0.16em] uppercase"
          style={{
            borderColor: "var(--accent-line)",
            background:
              "color-mix(in_srgb,var(--bg-deep)_82%,transparent)",
            color: "var(--accent)",
          }}
        >
          {item.kind}
        </div>

        <div className="absolute bottom-2 right-2 border border-line bg-[color-mix(in_srgb,var(--bg-deep)_88%,transparent)] px-2 py-1 text-[0.52rem] font-bold tracking-[0.12em] uppercase">
          {item.id.replace("media-", "#")}
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="t-label text-[0.5rem]">media item</p>
            <p className="mt-1 truncate text-[0.72rem] font-semibold">
              {item.label ?? optionLabel(primary)}
            </p>
          </div>

          <span className="shrink-0 text-[0.58rem] text-dim">
            {item.options.length} option
            {item.options.length === 1 ? "" : "s"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => primary && download(primary)}
          disabled={!primary || downloading}
          className="btn btn-primary min-h-[42px] w-full text-[0.62rem] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? "Preparing..." : "Download this media"}
        </button>

        {item.options.length > 1 && (
          <div className="space-y-1.5 border-t border-line pt-2">
            <p className="t-label text-[0.48rem]">available versions</p>

            <div className="grid gap-1.5 sm:grid-cols-2">
              {item.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => download(option)}
                  disabled={downloading}
                  className="border border-line px-2.5 py-2 text-left text-[0.58rem] transition hover:border-[var(--accent-line)] hover:text-[var(--accent)] disabled:opacity-60"
                >
                  <span className="block font-semibold">
                    {optionLabel(option)}
                  </span>
                  <span className="mt-0.5 block text-dim">
                    {[
                      option.format?.toUpperCase(),
                      option.mimeType,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "media"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function MediaGallery({
  items,
  title,
}: {
  items: NormalizedMediaItem[];
  title?: string;
}) {
  if (!items.length) return null;

  return (
    <section aria-label="Media gallery" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="t-label">media gallery</p>
          <h2 className="mt-1 text-sm font-bold tracking-tight">
            {items.length} media item{items.length === 1 ? "" : "s"}
          </h2>
        </div>

        <span className="text-[0.58rem] text-dim">
          Select an item to download it individually
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} title={title} />
        ))}
      </div>
    </section>
  );
}
