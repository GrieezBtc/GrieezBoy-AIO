import { clientKey, rateLimit } from "@/lib/rateLimit";
import { resolveHubStream } from "@/services/videoHub/client";
import { hubError } from "@/services/videoHub/normalizer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "hub-resolve"), 60, 60_000);

  if (!limit.allowed) {
    return Response.json(hubError("RATE_LIMITED"), {
      status: 429,
      headers: {
        "retry-after": String(limit.retryAfterSeconds),
      },
    });
  }

  const { searchParams } = new URL(request.url);
  const url = (searchParams.get("url") ?? "").trim();

  if (!url) {
    return Response.json(hubError("BAD_QUERY"), {
      status: 400,
    });
  }

  const resolved = await resolveHubStream({
    url,
    signal: request.signal,
  });

  return Response.json(resolved, {
    status: resolved.success
      ? 200
      : resolved.error.code === "RATE_LIMITED"
        ? 429
        : 502,
    headers: {
      "cache-control": "no-store",
    },
  });
}
