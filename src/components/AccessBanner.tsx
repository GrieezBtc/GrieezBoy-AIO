"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { COIN_COST, WELCOME_COINS } from "@/lib/access";

export function AccessBanner() {
  const auth = useAuth();
  if (!auth.configured || !auth.ready) return null;

  let text: string;
  let action: { label: string; onClick?: () => void; href?: string } | null = null;

  if (auth.status === "guest") {
    text = `Guest mode: Snapchat, Threads and the Video Hub are open to you. Sign up free for ${WELCOME_COINS} 🪙 coins.`;
    action = { label: "Sign up free", href: "/login?mode=signup" };
  } else if (auth.status === "member") {
    text =
      auth.coins > 0
        ? `🪙 ${auth.coins} coin${auth.coins === 1 ? "" : "s"} left · ${COIN_COST} coin per successful download`
        : "You're out of coins 🪙";
    action = { label: "Get coins", onClick: () => auth.openPrompt(auth.coins > 0 ? "upgrade" : "no_coins") };
  } else {
    text = "Premium · unlimited downloads";
  }

  return (
    <div className="panel-flat flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[0.8rem]">
      <p className="text-dim">{text}</p>
      {action?.href ? (
        <Link href={action.href} className="font-semibold text-accent hover:opacity-70">
          {action.label} →
        </Link>
      ) : action ? (
        <button type="button" onClick={action.onClick} className="font-semibold text-accent hover:opacity-70">
          {action.label} →
        </button>
      ) : null}
    </div>
  );
}
