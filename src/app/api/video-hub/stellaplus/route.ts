import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STELLAPLUS_ENDPOINT =
  "https://apis.davidcyril.name.ng/stellaplus";

const TIMEOUT_MS = 15_000;

type StellaPlusResponse = {
  title?: unknown;
  thumbnail?: unknown;
  downloadUrl?: unknown;
  postUrl?: unknown;
};

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(STELLAPLUS_ENDPOINT, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const body = (await response.json()) as StellaPlusResponse;

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UPSTREAM_ERROR",
            message: "The video source returned an error.",
            retryable: true,
          },
        },
        { status: 502 },
      );
    }

    if (
      typeof body.title !== "string" ||
      !isHttpUrl(body.thumbnail) ||
      !isHttpUrl(body.downloadUrl) ||
      !isHttpUrl(body.postUrl)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MALFORMED_RESPONSE",
            message: "The video source returned an invalid response.",
            retryable: true,
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      video: {
        title: body.title,
        thumbnail: body.thumbnail,
        playback: {
          url: body.downloadUrl,
          type: "mp4",
        },
        downloadUrl: body.downloadUrl,
        sourceUrl: body.postUrl,
      },
    });
  } catch (error) {
    const isAbort =
      error instanceof Error && error.name === "AbortError";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
          message: isAbort
            ? "The video source took too long to respond."
            : "Unable to reach the video source.",
          retryable: true,
        },
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
