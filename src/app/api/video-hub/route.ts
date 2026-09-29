import { clientKey, rateLimit } from "@/lib/rateLimit";
import { cacheGet, cacheSet } from "@/lib/serverCache";
import { fetchHubFeed } from "@/services/videoHub/client";
import { hubError } from "@/services/videoHub/normalizer";
import type { HubResponse } from "@/services/videoHub/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN_TTL_SECONDS = 600;

/*
 * YouTube pagination uses opaque page tokens rather than numeric pages.
 *
 * The browser still works with page=0,1,2...
 * while the actual YouTube token stays server-side.
 */
function tokenCacheKey(query: string, page: number): string {
  return `hub-token:${query.toLowerCase()}:${page}`;
}

export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "hub"), 60, 60_000);

  if (!limit.allowed) {
    return Response.json(hubError("RATE_LIMITED"), {
      status: 429,
      headers: {
        "retry-after": String(limit.retryAfterSeconds),
      },
    });
  }

  const { searchParams } = new URL(request.url);

  const query = (searchParams.get("q") ?? "")
    .trim()
    .slice(0, 120);

  const pageRaw = Number(searchParams.get("page") ?? "0");

  const page = Number.isFinite(pageRaw)
    ? Math.min(Math.max(0, Math.floor(pageRaw)), 50)
    : 0;

  const cacheKey = `hub:${query.toLowerCase()}:${page}`;

  const cached = await cacheGet<HubResponse>(cacheKey);

  if (cached?.success) {
    return Response.json(cached, {
      headers: {
        "cache-control": "no-store",
      },
    });
  }

  let pageToken: string | undefined;

  if (query && page > 0) {
    pageToken =
      (await cacheGet<string>(
        tokenCacheKey(query, page),
      )) ?? undefined;

    if (!pageToken) {
      return Response.json(
        hubError("NOT_FOUND"),
        {
          status: 404,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }
  }

  const result = await fetchHubFeed({
    query,
    page,
    pageToken,
    signal: request.signal,
  });

  const feed = result.feed;

  if (!feed.success) {
    return Response.json(feed, {
      status:
        feed.error.code === "RATE_LIMITED"
          ? 429
          : feed.error.code === "NOT_FOUND"
            ? 404
            : 502,
      headers: {
        "cache-control": "no-store",
      },
    });
  }

  /*
   * The client currently receives only HubFeed, so derive the next token
   * from the internal response isn't possible here. The next step will
   * expose the token through the service layer without sending it to the
   * browser directly.
   */
  await cacheSet(cacheKey, "hub", feed, 180);

  return Response.json(feed, {
    status: 200,
    headers: {
      "cache-control": "no-store",
    },
  });
}
