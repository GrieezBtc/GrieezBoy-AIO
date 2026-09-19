"use client";

import { useEffect, useRef, useState } from "react";
import type { HubVideo } from "@/services/videoHub/types";

type Props = {
  video: HubVideo;
  onClose: () => void;
  onDownload: (url: string) => void;
  onShare: (video: HubVideo) => void;
};

type Resolved = { url: string; type: "mp4" | "hls" | "unknown" };

export function VideoPlayer({ video, onClose, onDownload, onShare }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<Resolved | null>(
    video.playback.url ? { url: video.playback.url, type: video.playback.type } : null,
  );
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>(video.downloadUrl);
  const [status, setStatus] = useState<"idle" | "resolving" | "error">(
    video.playback.url ? "idle" : "resolving",
  );

  /* Resolve stream URL through the dedicated resolver route when required. */
  useEffect(() => {
    if (video.playback.url) return;
    const controller = new AbortController();
    setStatus("resolving");
    fetch(`/api/video-hub/resolve?url=${encodeURIComponent(video.sourceUrl ?? "")}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload: unknown) => {
        const data = payload as {
          success?: boolean;
          playback?: Resolved;
          downloadUrl?: string;
        };
        if (data.success && data.playback?.url) {
          setSource(data.playback);
          if (data.downloadUrl) setDownloadUrl(data.downloadUrl);
          setStatus("idle");
        } else {
          setStatus("error");
        }
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [video.sourceUrl, video.playback.url]);

  /* Attach the stream — native first, hls.js only when needed. */
  useEffect(() => {
    const element = videoRef.current;
    if (!element || !source) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;

    const isHls = source.type === "hls" || source.url.includes(".m3u8");
    if (!isHls || element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = source.url;
      return () => {
        element.removeAttribute("src");
        element.load();
      };
    }

    void import("hls.js").then((module) => {
      const Hls = module.default;
      if (destroyed || !Hls.isSupported()) {
        if (!destroyed) element.src = source.url;
        return;
      }
      const instance = new Hls({ maxBufferLength: 20, capLevelToPlayerSize: true });
      instance.loadSource(source.url);
      instance.attachMedia(element);
      hls = instance;
    });

    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [source]);

  /* Focus trap-lite + escape handling */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[color-mix(in_srgb,var(--bg-deep)_86%,transparent)] p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
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
          {status === "resolving" ? (
            <div className="skeleton absolute inset-0 grid place-items-center">
              <span className="t-label">resolving stream…</span>
            </div>
          ) : null}
          {status === "error" ? (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <p className="text-[0.8rem]" style={{ color: "var(--danger)" }}>
                [!] Stream could not be resolved. Try another entry.
              </p>
            </div>
          ) : null}
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            poster={video.thumbnailUrl}
            className="h-full w-full"
          >
            <track kind="captions" />
          </video>
        </div>

        <div className="space-y-3 p-3.5 sm:p-4">
          <h2 className="text-[0.95rem] leading-snug font-bold text-balance">
            {video.title}
          </h2>
          <div className="t-label flex flex-wrap gap-x-3 gap-y-1 normal-case">
            {video.author?.name ? <span>{video.author.name}</span> : null}
            {video.durationLabel ? <span>{video.durationLabel}</span> : null}
            {video.viewsLabel ? <span>{video.viewsLabel} views</span> : null}
            <span>stream: {source?.type ?? "pending"}</span>
          </div>
          {video.description ? (
            <p className="text-[0.75rem] leading-relaxed text-dim">{video.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {downloadUrl ? (
              <a
                href={downloadUrl}
                download
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => onDownload(downloadUrl)}
                className="btn btn-primary px-4 text-[0.62rem]"
              >
                <span aria-hidden>⤓</span> Download
              </a>
            ) : (
              <span className="btn btn-ghost cursor-not-allowed px-4 text-[0.62rem] opacity-60">
                Download unavailable
              </span>
            )}
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
