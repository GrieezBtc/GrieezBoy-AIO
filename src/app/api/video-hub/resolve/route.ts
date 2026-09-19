import { clientKey, rateLimit } from "@/lib/rateLimit";
import { resolveHubStream } from "@/services/videoHub/client";
import { hubError } from "@/services/videoHub/normalizer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "hub-resolve"), 60, 60_000);
  if (!limit.allowed) {
    return Response.json(hubError("RATE_LIMITED"), { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") ?? "").trim();
  if (!id) return Response.json(hubError("BAD_QUERY"), { status: 400 });

  const resolved = await resolveHubStream({ id, signal: request.signal });
  return Response.json(resolved, {
    status: resolved.success ? 200 : 502,
    headers: { "cache-control": "no-store" },
  });
}
