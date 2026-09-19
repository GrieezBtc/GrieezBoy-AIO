"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import type { DownloadOption } from "@/services/aioDownloader/types";

const GROUPS: Array<{ type: DownloadOption["type"]; label: string; glyph: string }> = [
  { type: "video", label: "Video streams", glyph: "▶" },
  { type: "audio", label: "Audio streams", glyph: "♪" },
  { type: "image", label: "Image assets", glyph: "▣" },
];

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-line px-1.5 py-0.5 text-[0.55rem] tracking-[0.12em] text-faint uppercase">
      {children}
    </span>
  );
}

function OptionRow({
  option,
  index,
  filename,
}: {
  option: DownloadOption;
  index: number;
  filename: string;
}) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(option.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      push({ title: "Link copied", body: "Direct URL copied to clipboard.", tone: "ok" });
    } catch {
      push({ title: "Copy failed", body: "Clipboard access denied.", tone: "error" });
    }
  };

  const expiresSoon = option.expiresAt
    ? new Date(option.expiresAt).getTime() - Date.now() < 3_600_000
    : false;

  return (
    <li
      className="reveal grid gap-2 border border-line bg-[color-mix(in_srgb,var(--panel-solid)_62%,transparent)] p-2.5 transition-colors hover:border-[var(--line-strong)] sm:grid-cols-[1fr_auto] sm:items-center"
      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[0.78rem] font-bold tracking-[0.06em]">
          <span aria-hidden className="text-accent">
            {option.type === "audio" ? "♪" : option.type === "image" ? "▣" : "▶"}
          </span>
          <span className="truncate">{option.label}</span>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {option.resolution?.width && option.resolution.height ? (
            <Badge>
              {option.resolution.width}×{option.resolution.height}
            </Badge>
          ) : null}
          {option.mimeType ? <Badge>{option.mimeType}</Badge> : null}
          {option.hasAudio === false ? <Badge>no audio</Badge> : null}
          {option.hasAudio === true && option.type === "video" ? <Badge>a/v</Badge> : null}
          {option.fileSizeLabel ? <Badge>{option.fileSizeLabel}</Badge> : null}
          {option.expiresAt ? (
            <span
              className="border px-1.5 py-0.5 text-[0.55rem] tracking-[0.12em] uppercase"
              style={{
                borderColor: expiresSoon ? "var(--amber)" : "var(--line)",
                color: expiresSoon ? "var(--amber)" : "var(--text-faint)",
              }}
            >
              expires {new Date(option.expiresAt).toISOString().slice(11, 16)}Z
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="btn btn-ghost h-10 min-h-[44px] px-3 text-[0.62rem]"
          aria-label={`Copy direct link for ${option.label}`}
        >
          <span aria-hidden>{copied ? "✓" : "⧉"}</span>
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={option.url}
          download={filename}
          target="_blank"
          rel="noreferrer noopener"
          onClick={() =>
            push({
              title: "Download started",
              body: option.label,
              tone: "ok",
            })
          }
          className="btn btn-primary h-10 min-h-[44px] flex-1 px-4 text-[0.62rem] sm:flex-none"
        >
          <span aria-hidden>⤓</span> Download
        </a>
      </div>
    </li>
  );
}

export function DownloadOptions({
  options,
  title,
}: {
  options: DownloadOption[];
  title?: string;
}) {
  const safeName = (title ?? "griezboy-media")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .slice(0, 60)
    .replace(/\s+/g, "_");

  return (
    <div className="space-y-5">
      {GROUPS.map((group) => {
        const groupOptions = options.filter((option) => option.type === group.type);
        if (!groupOptions.length) return null;
        return (
          <section key={group.type} aria-label={group.label}>
            <h4 className="t-label mb-2 flex items-center gap-2">
              <span aria-hidden>{group.glyph}</span>
              {group.label}
              <span className="text-faint">[{groupOptions.length}]</span>
            </h4>
            <ul className="grid gap-2">
              {groupOptions.map((option, index) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  index={index}
                  filename={`${safeName || "media"}.${option.format ?? "bin"}`}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
