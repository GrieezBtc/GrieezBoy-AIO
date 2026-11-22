"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { DAILY_LIMIT } from "@/lib/access";

export function AccessBanner() {
  const auth = useAuth();
  if (!auth.configured || !auth.ready) return null;

  let text: string;
  let action: { label: string; onClick?: () => void; href?: string } | null = null;

  if (auth.status === "guest") {
    text = "Guest mode: Snapchat, Threads and the Video Hub are open to you.";
    action = { label: "Sign up free", href: "/login?mode=signup" };
  } else if (auth.status === "trial") {
    const days = auth.trialDaysLeft;
    text = `Free trial · ${days} day${days === 1 ? "" : "s"} left · ${auth.remainingToday} of ${DAILY_LIMIT} downloads left today`;
    action = { label: "Go premium", onClick: () => auth.openPrompt("upgrade") };
  } else if (auth.status === "trial_expired") {
    text = "Your free week has ended. Go premium to keep downloading.";
    action = { label: "Go premium", onClick: () => auth.openPrompt("trial_expired") };
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
        <button
          type="button"
          onClick={action.onClick}
          className="font-semibold text-accent hover:opacity-70"
        >
          {action.label} →
        </button>
      ) : null}
    </div>
  );
}
