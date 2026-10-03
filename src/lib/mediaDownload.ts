import type { DownloadOption } from "@/services/aioDownloader/types";

export function safeMediaName(title?: string) {
  return (title ?? "griezboy-media")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .slice(0, 60)
    .replace(/\s+/g, "_");
}

export function triggerMediaDownload(
  option: DownloadOption,
  title?: string,
) {
  const safeName = safeMediaName(title) || "media";
  const filename = `${safeName}.${option.format ?? "bin"}`;

  const anchor = document.createElement("a");

  anchor.href =
    `/api/media?url=${encodeURIComponent(option.url)}` +
    `&filename=${encodeURIComponent(filename)}`;

  anchor.download = filename;
  anchor.rel = "noreferrer";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  return filename;
}
