import { downloadError } from "@/services/aioDownloader/errors";
import type { NormalizedDownloadError, SupportedPlatform } from "@/services/aioDownloader/types";
import { isGuestPlatform } from "@/lib/access";
import { getSupabaseServer } from "@/lib/supabase/server";

type Gate =
  | { ok: true; refund: () => Promise<void> }
  | { ok: false; error: NormalizedDownloadError };

const NOOP = async () => {};

/**
 * Decides whether this request may be processed, and counts it.
 *  - no account  -> Snapchat / Threads only
 *  - trial       -> everything, 3 links per day
 *  - premium     -> everything, unlimited
 * If Supabase is not configured the site behaves exactly as before.
 */
export async function gateDownload(platforms: SupportedPlatform[]): Promise<Gate> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: true, refund: NOOP };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (platforms.every(isGuestPlatform)) return { ok: true, refund: NOOP };
    return { ok: false, error: downloadError("AUTH_REQUIRED") };
  }

  const { data, error } = await supabase.rpc("consume_download");
  if (error || !data) {
    console.error("consume_download failed", error?.message);
    return { ok: false, error: downloadError("UPSTREAM_ERROR") };
  }

  const result = data as { allowed: boolean; reason: string; ticket?: string };
  if (!result.allowed) {
    if (result.reason === "trial_expired") return { ok: false, error: downloadError("TRIAL_EXPIRED") };
    if (result.reason === "daily_limit") return { ok: false, error: downloadError("DAILY_LIMIT") };
    return { ok: false, error: downloadError("AUTH_REQUIRED") };
  }

  const ticket = result.ticket;
  return {
    ok: true,
    refund: async () => {
      if (!ticket) return;
      const { error: refundError } = await supabase.rpc("refund_download", { p_ticket: ticket });
      if (refundError) console.error("refund_download failed", refundError.message);
    },
  };
}
