import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "api.fastsaver.io",
  "api.saveapi.org",
  "cf-st.sc-cdn.net",
  "med.stellaplus.xyz",
]);

function isAllowedHostname(hostname: string): boolean {
  return (
    ALLOWED_HOSTS.has(hostname) ||
    hostname.endsWith(".fbcdn.net")
  );
}

function isAllowedMediaUrl(value: string): URL | null {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return null;
    if (!isAllowedHostname(url.hostname)) return null;

    return url;
  } catch {
    return null;
  }
}

function safeFilename(value: string | null): string {
  return (
    (value ?? "grieezboy-media")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100) || "grieezboy-media"
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const urlParam = requestUrl.searchParams.get("url");
  const filename = safeFilename(requestUrl.searchParams.get("filename"));

  if (!urlParam) {
    return NextResponse.json(
      { success: false, error: "Missing media URL." },
      { status: 400 },
    );
  }

  let mediaUrl = isAllowedMediaUrl(urlParam);

  if (!mediaUrl) {
    try {
      console.log("[media] rejected host:", new URL(urlParam).hostname);
    } catch {
      console.log("[media] rejected invalid URL");
    }

    return NextResponse.json(
      { success: false, error: "Media source is not allowed." },
      { status: 400 },
    );
  }

  try {
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      const upstream = await fetch(mediaUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "manual",
      });

      if (
        upstream.status >= 300 &&
        upstream.status < 400
      ) {
        const location = upstream.headers.get("location");

        if (!location) {
          return NextResponse.json(
            { success: false, error: "Media source returned an invalid redirect." },
            { status: 502 },
          );
        }

        const redirectedUrl = new URL(location, mediaUrl);
        const validated = isAllowedMediaUrl(redirectedUrl.toString());

        if (!validated) {
          return NextResponse.json(
            { success: false, error: "Media redirect target is not allowed." },
            { status: 502 },
          );
        }

        mediaUrl = validated;
        continue;
      }

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
    }

    return NextResponse.json(
      { success: false, error: "Too many media redirects." },
      { status: 502 },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Media download failed." },
      { status: 502 },
    );
  }
}
