import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "api.fastsaver.io",
  "api.saveapi.org",
  "cf-st.sc-cdn.net",
  "med.stellaplus.xyz",
]);

function isAllowedMediaUrl(value: string): URL | null {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return null;
    if (!ALLOWED_HOSTS.has(url.hostname)) return null;

    return url;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const urlParam = new URL(request.url).searchParams.get("url");
  const filenameParam = new URL(request.url).searchParams.get("filename");

  if (!urlParam) {
    return NextResponse.json(
      { success: false, error: "Missing media URL." },
      { status: 400 },
    );
  }

  const mediaUrl = isAllowedMediaUrl(urlParam);

  if (!mediaUrl) {
    return NextResponse.json(
      { success: false, error: "Media source is not allowed." },
      { status: 400 },
    );
  }

  const filename =
    (filenameParam ?? "grieezboy-media")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100) || "grieezboy-media";

  try {
    const upstream = await fetch(mediaUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { success: false, error: "Unable to retrieve the media file." },
        { status: upstream.status || 502 },
      );
    }

    const contentType =
      upstream.headers.get("content-type") ?? "application/octet-stream";

    const headers = new Headers();
    headers.set("content-type", contentType);
    headers.set(
      "content-disposition",
      `attachment; filename="${filename}"`,
    );
    headers.set("cache-control", "no-store");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      headers.set("content-length", contentLength);
    }

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Media download failed." },
      { status: 502 },
    );
  }
}
