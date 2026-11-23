import { downloadError } from "@/services/aioDownloader/errors";
import type { NormalizedDownloadError, SupportedPlatform } from "@/services/aioDownloader/types";
import { isGuestPlatform } from "@/lib/access";
import { getSupabaseServer } from "@/lib/supabase/server";

import type { RequestContext } from "@/lib/track";

export type EventType = "download" | "download_failed" | "blocked";
type Logger = (type: EventType, meta: Record<string, string>) => Promise<void>;

type Gate =
  | { ok: true; refund: () => Promise<void>; log: Logger }
  | { ok: false; error: NormalizedDownloadError; log: Logger };

const NOOP = async () => {};

/**
 * Decides whether this request may be processed, and counts it.
 *  - no account  -> Snapchat / Threads only
 *  - trial       -> everything, 3 links per day
 *  - premium     -> everything, unlimited
 * If Supabase is not configured the site behaves exactly as before.
 */
export async function gateDownload(
  platforms: SupportedPlatform[],
  ctx: RequestContext,
): Promise<Gate> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: true, refund: NOOP, log: NOOP };

  const log: Logger = async (type, meta) => {
    const { error: logError } = await supabase.rpc("log_event", {
      p_type: type,
      p_path: null,
      p_visitor: null,
      p_country: ctx.country,
      p_device: ctx.device,
      p_referrer: null,
      p_meta: meta,
    });
    if (logError) console.error("log_event failed", logError.message);
  };
  const blocked = (code: Parameters<typeof downloadError>[0]): Gate => ({
    ok: false,
    error: downloadError(code),
    log,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (platforms.every(isGuestPlatform)) return { ok: true, refund: NOOP, log };
    return blocked("AUTH_REQUIRED");
  }

  const { data, error } = await supabase.rpc("consume_download");
  if (error || !data) {
    console.error("consume_download failed", error?.message);
    return blocked("UPSTREAM_ERROR");
  }

  const result = data as { allowed: boolean; reason: string; ticket?: string };
  if (!result.allowed) {
    if (result.reason === "no_coins") return blocked("NO_COINS");
    if (result.reason === "trial_expired") return blocked("TRIAL_EXPIRED");
    if (result.reason === "daily_limit") return blocked("DAILY_LIMIT");
    return blocked("AUTH_REQUIRED");
  }

  const ticket = result.ticket;
  return {
    ok: true,
    log,
    refund: async () => {
      if (!ticket) return;
      const { error: refundError } = await supabase.rpc("refund_download", { p_ticket: ticket });
      if (refundError) console.error("refund_download failed", refundError.message);
    },
  };
}
