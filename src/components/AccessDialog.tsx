"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { COIN_COST, WELCOME_COINS } from "@/lib/access";
import { telegramLink, whatsappLink } from "@/lib/contact";

export type PromptKind = "login" | "no_coins" | "upgrade";

const COPY: Record<PromptKind, { title: string; body: string }> = {
  login: {
    title: "Create a free account",
    body: `Guests can use the Video Hub plus Snapchat and Threads downloads. Sign up free to unlock every platform and get ${WELCOME_COINS} 🪙 coins to start. Each successful download costs ${COIN_COST} coin.`,
  },
  no_coins: {
    title: "You're out of coins 🪙",
    body: "Top up your coins or go premium for unlimited downloads. Message us and we'll add them to your account.",
  },
  upgrade: {
    title: "Get coins or go premium",
    body: "Buy more coins 🪙, or go premium for unlimited downloads from every platform. Message us and we'll activate it on your account.",
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
  const message = `Hi, I'd like to get coins or go premium on GRIEEZBOY AIO.${email ? ` My account email: ${email}` : ""}`;

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
          {needsLogin ? "Free account" : "Coins & premium"}
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
                Message us on WhatsApp
              </a>
              <a
                href={telegramLink(message)}
                target="_blank"
                rel="noreferrer noopener"
                className="btn"
              >
                Message us on Telegram
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
