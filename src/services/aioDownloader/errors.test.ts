import { describe, expect, it } from "vitest";
import {
  codeFromHttpStatus,
  codeFromUpstreamText,
  downloadError,
} from "./errors";

describe("provider error classification", () => {
  it.each([
    "No credits left",
    "You are out of credits",
    "Credits exhausted",
    "Insufficient credits",
    "Quota exceeded",
    "Quota exhausted",
    "Credit balance is zero",
  ])("recognizes provider quota message: %s", (message) => {
    expect(codeFromUpstreamText(message)).toBe("PROVIDER_QUOTA_EXCEEDED");
  });

  it("keeps unsupported URL messages separate from quota errors", () => {
    expect(codeFromUpstreamText("Unsupported URL")).toBe("INVALID_URL");
    expect(codeFromUpstreamText("This post is not supported")).toBe(
      "UNSUPPORTED_PLATFORM",
    );
  });

  it("recognizes rate limiting", () => {
    expect(codeFromUpstreamText("Too many requests")).toBe("RATE_LIMITED");
    expect(codeFromUpstreamText("Rate limit reached")).toBe("RATE_LIMITED");
  });

  it("does not guess that an ambiguous quota message means rate limiting", () => {
    expect(codeFromUpstreamText("Quota status unclear")).toBe(
      "UPSTREAM_ERROR",
    );
  });

  it("keeps HTTP 400 ambiguous unless the response body identifies the cause", () => {
    expect(codeFromHttpStatus(400)).toBe("INVALID_URL");
    expect(codeFromUpstreamText("Bad request")).toBe("UPSTREAM_ERROR");
  });

  it("returns the safe user-facing quota error", () => {
    expect(downloadError("PROVIDER_QUOTA_EXCEEDED")).toEqual({
      success: false,
      error: {
        code: "PROVIDER_QUOTA_EXCEEDED",
        message:
          "The download provider has run out of credits. Please try again later.",
        retryable: false,
      },
    });
  });
});
