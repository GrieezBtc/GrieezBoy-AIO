import { clientKey, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_DESCRIPTION = 4000;
const MAX_CONTACT = 200;
const MAX_URL = 2048;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const VALID_PLATFORMS = new Set([
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "twitter",
  "pinterest",
  "threads",
  "snapchat",
  "other",
]);

function jsonError(message: string, status = 400) {
  return Response.json(
    { success: false, error: message },
    {
      status,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function telegramRequest(
  token: string,
  method: string,
  body: FormData | URLSearchParams,
): Promise<boolean> {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      body,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error(`[contact] Telegram ${method} failed:`, response.status);
    return false;
  }

  const result = (await response.json()) as { ok?: boolean };
  return result.ok === true;
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "contact"), 3, 10 * 60_000);

  if (!limit.allowed) {
    return jsonError(
      `Too many reports. Try again in about ${limit.retryAfterSeconds} seconds.`,
      429,
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    console.error("[contact] Telegram environment variables are missing.");
    return jsonError("Customer care is temporarily unavailable.", 503);
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return jsonError("Invalid report payload.");
  }

  const platform = String(form.get("platform") ?? "").trim().toLowerCase();
  const description = String(form.get("description") ?? "").trim();
  const affectedUrl = String(form.get("affectedUrl") ?? "").trim();
  const contact = String(form.get("contact") ?? "").trim();
  const screenshot = form.get("screenshot");

  if (!VALID_PLATFORMS.has(platform)) {
    return jsonError("Select the platform affected by the issue.");
  }

  if (description.length < 10) {
    return jsonError("Please describe the issue in at least 10 characters.");
  }

  if (description.length > MAX_DESCRIPTION) {
    return jsonError("The issue description is too long.");
  }

  if (affectedUrl.length > MAX_URL) {
    return jsonError("The affected URL is too long.");
  }

  if (affectedUrl && !validHttpUrl(affectedUrl)) {
    return jsonError("The affected URL must be a valid HTTP or HTTPS URL.");
  }

  if (contact.length > MAX_CONTACT) {
    return jsonError("The contact information is too long.");
  }

  let image: File | null = null;

  if (screenshot instanceof File && screenshot.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.has(screenshot.type)) {
      return jsonError("Screenshot must be JPG, PNG or WebP.");
    }

    if (screenshot.size > MAX_SCREENSHOT_BYTES) {
      return jsonError("Screenshot must be 5 MB or smaller.");
    }

    image = screenshot;
  }

  const platformLabel =
    platform.charAt(0).toUpperCase() + platform.slice(1);

  const lines = [
    "GRIEEZBOY AIO — ISSUE REPORT",
    "",
    `Platform: ${platformLabel}`,
    `Description: ${description}`,
    affectedUrl ? `Affected URL: ${affectedUrl}` : "Affected URL: not provided",
    contact ? `Contact: ${contact}` : "Contact: not provided",
    "",
    `User agent: ${(request.headers.get("user-agent") ?? "unknown").slice(0, 500)}`,
  ];

  const message = lines.join("\n");

  let sent = false;

  if (image) {
    const telegramForm = new FormData();
    telegramForm.append("chat_id", chatId);
    telegramForm.append("caption", message.slice(0, 1024));
    telegramForm.append(
      "photo",
      new Blob([await image.arrayBuffer()], { type: image.type }),
      image.name || "screenshot",
    );

    sent = await telegramRequest(token, "sendPhoto", telegramForm);
  } else {
    const telegramForm = new URLSearchParams();
    telegramForm.set("chat_id", chatId);
    telegramForm.set("text", message);

    sent = await telegramRequest(token, "sendMessage", telegramForm);
  }

  if (!sent) {
    return jsonError("We could not send your report. Please try again later.", 502);
  }

  return Response.json(
    { success: true },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
