"use client";

import { FormEvent, useRef, useState } from "react";

const PLATFORMS = [
  ["youtube", "YouTube"],
  ["tiktok", "TikTok"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["twitter", "Twitter / X"],
  ["pinterest", "Pinterest"],
  ["threads", "Threads"],
  ["snapchat", "Snapchat"],
  ["other", "Other"],
];

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setSending(true);

    try {
      const form = new FormData(event.currentTarget);

      const response = await fetch("/api/contact", {
        method: "POST",
        body: form,
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not send the report.");
      }

      formRef.current?.reset();

      setResult({
        type: "success",
        message: "Report sent successfully. Customer care has received it.",
      });
    } catch (error) {
      setResult({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not send the report. Please try again.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event);
      }}
      noValidate={false}
      className="grid gap-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="t-label">Platform</span>
          <select
            name="platform"
            required
            defaultValue=""
            className="min-h-11 w-full border border-line bg-[var(--panel-solid)] px-3 text-[0.78rem] text-ink outline-none transition-colors focus:border-[var(--accent-line)]"
          >
            <option value="" disabled>
              Select platform
            </option>
            {PLATFORMS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="t-label">Affected URL</span>
          <input
            name="affectedUrl"
            type="url"
            maxLength={2048}
            placeholder="https://..."
            className="min-h-11 w-full border border-line bg-[var(--panel-solid)] px-3 text-[0.78rem] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
          />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="t-label">What went wrong?</span>
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          placeholder="Describe what you expected, what happened, and any error message you saw."
          className="w-full resize-y border border-line bg-[var(--panel-solid)] px-3 py-3 text-[0.78rem] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="t-label">Screenshot</span>
          <input
            name="screenshot"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="min-h-11 w-full border border-line bg-[var(--panel-solid)] px-3 py-2 text-[0.72rem] text-dim file:mr-3 file:border-0 file:bg-transparent file:text-[0.72rem] file:font-semibold file:text-ink"
          />
          <span className="text-[0.65rem] text-faint">
            JPG, PNG or WebP · max 5 MB
          </span>
        </label>

        <label className="grid gap-2">
          <span className="t-label">Contact (optional)</span>
          <input
            name="contact"
            type="text"
            maxLength={200}
            placeholder="Telegram, WhatsApp or email"
            className="min-h-11 w-full border border-line bg-[var(--panel-solid)] px-3 text-[0.78rem] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
          />
          <span className="text-[0.65rem] text-faint">
            Only provide this if you want a reply.
          </span>
        </label>
      </div>

      {result ? (
        <div
          role="status"
          className={`border px-3 py-3 text-[0.72rem] leading-relaxed ${
            result.type === "success"
              ? "border-[var(--accent-line)] text-accent"
              : "border-[color-mix(in_srgb,var(--danger)_45%,transparent)] text-[var(--danger)]"
          }`}
        >
          {result.message}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-lg text-[0.65rem] leading-relaxed text-faint">
          Reports are sent privately to customer care. Uploaded screenshots
          are forwarded with the report and are not stored by GRIEEZBOY AIO.
        </p>

        <button
          type="submit"
          disabled={sending}
          className="btn btn-primary min-h-11 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send report"}
        </button>
      </div>
    </form>
  );
}
