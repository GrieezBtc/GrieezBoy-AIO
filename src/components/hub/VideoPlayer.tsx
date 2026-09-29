"use client";

import { useEffect, useRef } from "react";
import type { HubVideo } from "@/services/videoHub/types";

type Props = {
  video: HubVideo;
  onClose: () => void;
  onDownload: () => void;
  onShare: (video: HubVideo) => void;
};

function getYouTubeVideoId(video: HubVideo): string | null {
  const source = video.sourceUrl?.trim();

  if (!source) {
    return video.id || null;
  }

  try {
    const url = new URL(source);

    if (url.hostname === "youtu.be") {
      return url.pathname.replace(/^\/+/, "").split("/")[0] || null;
    }

    if (
      url.hostname === "youtube.com" ||
      url.hostname === "www.youtube.com" ||
      url.hostname === "m.youtube.com"
    ) {
      return url.searchParams.get("v");
    }
  } catch {
    return video.id || null;
  }

  return video.id || null;
}

export function VideoPlayer({
  video,
  onClose,
  onDownload,
  onShare,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoId = getYouTubeVideoId(video);

  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${encodeURIComponent(
        videoId,
      )}?autoplay=1&rel=0`
    : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[color-mix(in_srgb,var(--bg-deep)_86%,transparent)] p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Player: ${video.title}`}
        tabIndex={-1}
        className="panel reveal max-h-[92dvh] w-full max-w-4xl overflow-y-auto outline-none"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
          <p className="t-label truncate">Now playing</p>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost h-9 min-h-[40px] px-3 text-[0.62rem]"
          >
            <span aria-hidden>✕</span> Close
          </button>
        </header>

        <div className="relative aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={video.title}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <p
                className="text-[0.8rem]"
                style={{ color: "var(--danger)" }}
              >
                [!] YouTube video could not be opened.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3 p-3.5 sm:p-4">
          <h2 className="text-[0.95rem] leading-snug font-bold text-balance">
            {video.title}
          </h2>

          <div className="t-label flex flex-wrap gap-x-3 gap-y-1 normal-case">
            {video.author?.name ? (
              <span>{video.author.name}</span>
            ) : null}

            {video.durationLabel ? (
              <span>{video.durationLabel}</span>
            ) : null}

            {video.viewsLabel ? (
              <span>{video.viewsLabel} views</span>
            ) : null}

            <span>YouTube</span>
          </div>

          {video.description ? (
            <p className="text-[0.75rem] leading-relaxed text-dim">
              {video.description}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="btn btn-primary px-4 text-[0.62rem]"
            >
              <span aria-hidden>⤓</span> Download
            </button>

            <button
              type="button"
              onClick={() => onShare(video)}
              className="btn px-4 text-[0.62rem]"
            >
              <span aria-hidden>↗</span> Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
