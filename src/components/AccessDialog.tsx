"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { DAILY_LIMIT, TRIAL_DAYS } from "@/lib/access";
import { telegramLink, whatsappLink } from "@/lib/contact";

export type PromptKind = "login" | "trial_expired" | "daily_limit" | "upgrade";

const COPY: Record<PromptKind, { title: string; body: string }> = {
  login: {
    title: "Create a free account",
    body: `Guests can use the Video Hub plus Snapchat and Threads downloads. Sign up free to unlock every platform for ${TRIAL_DAYS} days (${DAILY_LIMIT} downloads a day).`,
  },
  trial_expired: {
    title: "Your free week has ended",
    body: "Thanks for trying GRIEEZBOY AIO. Go premium to keep downloading from every platform with no daily limit.",
  },
  daily_limit: {
    title: "You've used today's free downloads",
    body: `Free accounts get ${DAILY_LIMIT} downloads a day. Your count resets tomorrow, or go premium for unlimited downloads now.`,
  },
  upgrade: {
    title: "Go premium",
    body: "Unlimited downloads from every platform, no daily limit. Message us and we'll activate it on your account.",
  },
};

export function AccessDialog({
  kind,
  email,
  onClose,
}: {
  kind: PromptKind | null;
  email: string | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!kind) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);

  if (!kind) return null;
  const copy = COPY[kind];
  const needsLogin = kind === "login";
  const message = `Hi, I'd like to subscribe to GRIEEZBOY AIO Premium.${email ? ` My account email: ${email}` : ""}`;

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-title"
        className="panel reveal w-full max-w-md p-5 sm:p-6"
      >
        <span
          className="rounded-full border px-2 py-1 text-[0.72rem] font-bold"
          style={{ borderColor: "var(--accent-line)", color: "var(--accent)" }}
        >
          {needsLogin ? "Free account" : "Premium"}
        </span>
        <h2 id="access-title" className="mt-3 text-xl font-bold tracking-tight">
          {copy.title}
        </h2>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-dim">{copy.body}</p>

        <div className="mt-5 flex flex-col gap-2">
          {needsLogin ? (
            <>
              <Link href="/login?mode=signup" onClick={onClose} className="btn btn-primary">
                Sign up free
              </Link>
              <Link href="/login" onClick={onClose} className="btn">
                I already have an account
              </Link>
            </>
          ) : (
            <>
              <a
                href={whatsappLink(message)}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-primary"
              >
                Subscribe on WhatsApp
              </a>
              <a
                href={telegramLink(message)}
                target="_blank"
                rel="noreferrer noopener"
                className="btn"
              >
                Subscribe on Telegram
              </a>
            </>
          )}
          <button ref={closeRef} type="button" onClick={onClose} className="btn btn-ghost">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
