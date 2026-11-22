import { clientKey, rateLimit } from "@/lib/rateLimit";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isBot, referrerHost, requestContext } from "@/lib/track";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMPTY = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

/** First-party page-view counter. Lives on your own domain, so ad blockers leave it alone. */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "hit"), 60, 60_000);
  if (!limit.allowed) return EMPTY();

  const ua = request.headers.get("user-agent") ?? "";
  if (isBot(ua)) return EMPTY();

  let body: { path?: unknown; vid?: unknown; ref?: unknown };
  try {
    body = await request.json();
  } catch {
    return EMPTY();
  }

  const path = typeof body.path === "string" ? body.path.split("?")[0].slice(0, 200) : "";
  if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) return EMPTY();

  const vid = typeof body.vid === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(body.vid) ? body.vid : null;

  const supabase = await getSupabaseServer();
  if (!supabase) return EMPTY();

  const ctx = requestContext(request);
  const { error } = await supabase.rpc("log_event", {
    p_type: "pageview",
    p_path: path,
    p_visitor: vid,
    p_country: ctx.country,
    p_device: ctx.device,
    p_referrer: referrerHost(body.ref, request.headers.get("host")),
    p_meta: null,
  });
  if (error) console.error("log_event failed", error.message);

  return EMPTY();
}
