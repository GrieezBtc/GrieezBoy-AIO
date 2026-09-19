import { clientKey, rateLimit } from "@/lib/rateLimit";
import { cacheGet, cacheSet } from "@/lib/serverCache";
import { fetchHubFeed } from "@/services/videoHub/client";
import { hubError } from "@/services/videoHub/normalizer";
import type { HubResponse } from "@/services/videoHub/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "hub"), 60, 60_000);
  if (!limit.allowed) {
    return Response.json(hubError("RATE_LIMITED"), {
      status: 429,
      headers: { "retry-after": String(limit.retryAfterSeconds) },
    });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, 120);
  const pageRaw = Number(searchParams.get("page") ?? "0");
  const page = Number.isFinite(pageRaw) ? Math.min(Math.max(0, Math.floor(pageRaw)), 200) : 0;

  const cacheKey = `hub:${query.toLowerCase()}:${page}`;
  const cached = await cacheGet<HubResponse>(cacheKey);
  if (cached && cached.success) {
    return Response.json(cached, { headers: { "cache-control": "no-store" } });
  }

  const feed = await fetchHubFeed({ query, page, signal: request.signal });
  if (feed.success) await cacheSet(cacheKey, "hub", feed, 180);

  return Response.json(feed, {
    status: feed.success ? 200 : feed.error.code === "RATE_LIMITED" ? 429 : 502,
    headers: { "cache-control": "no-store" },
  });
}
