"use client";

import type { HubVideo } from "@/services/videoHub/types";

type Props = {
  video: HubVideo;
  onWatch: (video: HubVideo) => void;
  onShare: (video: HubVideo) => void;
  onDownload: (video: HubVideo) => void;
  /** guests can watch but not download */
  downloadLocked?: boolean;
};

export function VideoCard({ video, onWatch, onShare, onDownload, downloadLocked }: Props) {
  return (
    <article className="rounded-2xl group flex flex-col border border-line bg-[var(--glass-soft)] transition-colors hover:border-[var(--accent-line)]">
      <button
        type="button"
        onClick={() => onWatch(video)}
        className="relative block aspect-video w-full overflow-hidden bg-[var(--bg-deep)] text-left"
        aria-label={`Watch ${video.title}`}
      >
        {video.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={video.thumbnailWidth ?? 640}
            height={video.thumbnailHeight ?? 360}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-[0.72rem] text-faint">
            no preview
          </span>
        )}
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ background: "color-mix(in srgb, var(--bg-deep) 45%, transparent)" }}
        >
          <span
            className="rounded-full grid h-11 w-11 place-items-center border text-sm"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            ▶
          </span>
        </span>
        {video.durationLabel ? (
          <span className="rounded-full absolute right-1.5 bottom-1.5 border border-line bg-[color-mix(in_srgb,var(--bg-deep)_82%,transparent)] px-1.5 py-0.5 text-[0.72rem] tabular-nums">
            {video.durationLabel}
          </span>
        ) : null}
        {video.playback.type === "hls" ? (
          <span
            className="rounded-full absolute top-1.5 left-1.5 border px-1.5 py-0.5 text-[0.72rem]"
            style={{ borderColor: "var(--violet)", color: "var(--violet)" }}
          >
            hls
          </span>
        ) : null}
      </button>

      <div className="flex flex-1 flex-col p-2.5">
        <h3 className="line-clamp-2 text-[0.8rem] leading-snug font-bold">
          {video.title}
        </h3>
        <p className="t-label mt-1.5 text-[0.72rem]">
          {[video.author?.name, video.viewsLabel ? `${video.viewsLabel} views` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <div className="mt-auto flex gap-1.5 pt-3">
          <button
            type="button"
            onClick={() => onWatch(video)}
            className="btn h-10 min-h-[44px] flex-1 px-2 text-[0.72rem]"
          >
            <span aria-hidden>▶</span> Watch
          </button>
          <button
            type="button"
            onClick={() => onDownload(video)}
            className="btn h-10 min-h-[44px] px-2.5 text-[0.72rem]"
            aria-label={downloadLocked ? `Sign in to download ${video.title}` : `Download ${video.title}`}
          >
            <span aria-hidden>{downloadLocked ? "🔒" : "⤓"}</span>
            <span className="sr-only sm:not-sr-only">{downloadLocked ? "Sign in" : "Get"}</span>
          </button>
          <button
            type="button"
            onClick={() => onShare(video)}
            className="btn h-10 min-h-[44px] px-2.5 text-[0.72rem]"
            aria-label={`Share ${video.title}`}
          >
            <span aria-hidden>↗</span>
            <span className="sr-only sm:not-sr-only">Share</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-[var(--glass-soft)]">
      <div className="skeleton aspect-video w-full" />
      <div className="space-y-2 p-2.5">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-2/3" />
        <div className="skeleton mt-3 h-10 w-full" />
      </div>
    </div>
  );
}
