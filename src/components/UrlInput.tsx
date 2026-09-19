"use client";

import { useEffect, useRef, type FormEvent } from "react";
import type { SupportedPlatform } from "@/services/aioDownloader/types";
import { PLATFORM_MAP } from "@/services/aioDownloader/platforms";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onPaste: () => void;
  loading: boolean;
  detected: SupportedPlatform | null;
  validationMessage: string | null;
  statusLine: string;
};

export function UrlInput({
  value,
  onChange,
  onSubmit,
  onClear,
  onPaste,
  loading,
  detected,
  validationMessage,
  statusLine,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (meta && event.key === "Enter") {
        event.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSubmit]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const accent = detected ? PLATFORM_MAP[detected].accent : "var(--accent)";

  return (
    <form
      onSubmit={handleSubmit}
      className="corner-marks panel relative w-full p-3 sm:p-4"
      style={{ borderColor: detected ? accent : "var(--line-strong)" }}
    >
      <div className="flex items-center justify-between gap-2 pb-2">
        <label
          htmlFor="media-url"
          className="t-label flex items-center gap-2 text-[0.6rem]"
        >
          <span aria-hidden style={{ color: accent }}>
            &gt;
          </span>
          Paste media url
        </label>
        <span className="t-label hidden text-[0.55rem] sm:inline">
          ⌘/CTRL + K focus · ⌘/CTRL + ⏎ execute
        </span>
      </div>

      <div
        className="relative flex flex-col gap-2 border border-line bg-[color-mix(in_srgb,var(--bg-deep)_72%,transparent)] p-2 sm:flex-row sm:items-center"
        style={{ borderColor: detected ? `${accent}55` : "var(--line)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
          <span
            aria-hidden
            className="shrink-0 text-sm font-bold select-none"
            style={{ color: accent }}
          >
            ▸
          </span>
          <input
            id="media-url"
            ref={inputRef}
            type="url"
            inputMode="url"
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://youtube.com/watch?v=..."
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-describedby="url-status"
            aria-invalid={validationMessage ? true : undefined}
            className="min-h-[44px] w-full min-w-0 bg-transparent text-[0.92rem] tracking-tight text-ink outline-none placeholder:text-faint"
          />
          {value ? (
            <button
              type="button"
              onClick={onClear}
              className="grid h-9 w-9 shrink-0 place-items-center border border-line text-faint transition-colors hover:border-[var(--line-strong)] hover:text-ink"
              aria-label="Clear URL"
            >
              <span aria-hidden>✕</span>
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onPaste}
            className="btn flex-1 px-3 text-[0.65rem] sm:flex-none"
          >
            <span aria-hidden>⎘</span> Paste
          </button>
          <button
            type="submit"
            disabled={loading || value.trim().length === 0}
            className="btn btn-primary flex-[2] px-5 sm:flex-none"
          >
            {loading ? (
              <>
                <span aria-hidden className="live-dot">
                  ▮
                </span>
                Working
              </>
            ) : (
              <>
                <span aria-hidden>⏎</span> Execute
              </>
            )}
          </button>
        </div>
      </div>

      <div
        id="url-status"
        aria-live="polite"
        className="mt-2 flex min-h-[20px] flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem]"
      >
        {validationMessage ? (
          <span style={{ color: "var(--danger)" }}>[!] {validationMessage}</span>
        ) : (
          <span className="text-faint">
            {statusLine}
            <span className="caret ml-1" aria-hidden>
              ▌
            </span>
          </span>
        )}
      </div>
    </form>
  );
}
