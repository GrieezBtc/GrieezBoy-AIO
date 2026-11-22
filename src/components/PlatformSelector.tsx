"use client";

import { PLATFORMS } from "@/services/aioDownloader/platforms";
import type { SupportedPlatform } from "@/services/aioDownloader/types";

type Props = {
  detected: SupportedPlatform | null;
  selected: SupportedPlatform | "auto";
  onSelect: (value: SupportedPlatform | "auto") => void;
  disabled?: boolean;
  /** platforms the visitor cannot use yet (shown with a lock) */
  lockedIds?: SupportedPlatform[];
  onLockedSelect?: (value: SupportedPlatform) => void;
};

export function PlatformSelector({
  detected,
  selected,
  onSelect,
  disabled,
  lockedIds = [],
  onLockedSelect,
}: Props) {
  const items: Array<{
    id: SupportedPlatform | "auto";
    label: string;
    short: string;
    hint: string;
    accent: string;
  }> = [
    {
      id: "auto",
      label: "Auto-detect",
      short: "AUTO",
      hint: "engine decides",
      accent: "var(--accent)",
    },
    ...PLATFORMS.map((platform) => ({
      id: platform.id,
      label: platform.label,
      short: platform.short,
      hint: platform.hint,
      accent: platform.accent,
    })),
  ];

  return (
    <section aria-labelledby="platform-selector-label" className="w-full">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="platform-selector-label" className="t-label">
          Choose a source
        </h2>
        <p className="t-label" aria-live="polite">
          {detected ? (
            <>
              <span className="text-faint">Detected: </span>
              <span className="font-bold text-accent">
                {PLATFORMS.find((p) => p.id === detected)?.label}
              </span>
            </>
          ) : (
            <span className="text-faint">Waiting for a link…</span>
          )}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Select source platform"
        className="no-scrollbar -mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8"
      >
        {items.map((item) => {
          const isSelected = selected === item.id;
          const isDetected = detected !== null && item.id === detected;
          const locked = item.id !== "auto" && lockedIds.includes(item.id);
          const highlight = !locked && (isSelected || (selected === "auto" && isDetected));
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => {
                if (locked && item.id !== "auto") onLockedSelect?.(item.id);
                else onSelect(item.id);
              }}
              className={`rounded-2xl group relative flex min-h-[64px] w-[116px] shrink-0 snap-start flex-col items-start justify-between gap-1 border px-3 py-2.5 text-left transition-all duration-150 disabled:opacity-50 sm:w-auto ${locked ? "opacity-60" : ""}`}
              style={{
                borderColor: highlight ? item.accent : "var(--line)",
                background: highlight
                  ? `color-mix(in srgb, ${item.accent} 12%, transparent)`
                  : "color-mix(in srgb, var(--panel-solid) 45%, transparent)",
                boxShadow: highlight ? `0 0 0 1px ${item.accent}33` : "none",
              }}
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span
                  className="text-[0.72rem] font-bold"
                  style={{ color: highlight ? item.accent : "var(--text-dim)" }}
                >
                  {item.short}
                </span>
                {locked ? (
                  <span aria-hidden className="text-[0.72rem]">
                    🔒
                  </span>
                ) : isDetected ? (
                  <span
                    aria-hidden
                    className="live-dot h-1.5 w-1.5 rounded-full"
                    style={{ background: item.accent }}
                  />
                ) : null}
              </span>
              <span className="text-[0.72rem] leading-tight font-medium">
                {item.label}
              </span>
              <span className="t-label text-[0.72rem]">{item.hint}</span>
              {isDetected ? <span className="sr-only">detected from URL</span> : null}
              {locked ? <span className="sr-only">locked, sign in required</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
