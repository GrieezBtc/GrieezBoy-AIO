export type DownloadProgress = {
  /** bytes received so far */
  received: number;
  /** total size in bytes when known (Content-Length or provider-reported size) */
  total?: number;
  /** 0-100 when total is known */
  percent?: number;
  /** rolling average speed in bytes per second */
  speedBps: number;
  /** estimated seconds remaining when total is known */
  etaSeconds?: number;
};

export type DownloadWithProgressOptions = {
  /** Direct media URL (the /api/media proxy is added for you). */
  url: string;
  filename: string;
  /** Size reported by the provider; used when the response has no Content-Length. */
  expectedBytes?: number;
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
};

/**
 * Downloads media through the /api/media proxy while reporting live progress,
 * then hands the finished file to the browser as a normal "save" download.
 * Resolves with the number of bytes saved.
 */
export async function downloadWithProgress({
  url,
  filename,
  expectedBytes,
  signal,
  onProgress,
}: DownloadWithProgressOptions): Promise<number> {
  const response = await fetch(
    `/api/media?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`,
    { signal, cache: "no-store" },
  );

  if (!response.ok || !response.body) {
    let message = "Unable to retrieve the media file.";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const headerLength = Number(response.headers.get("content-length"));
  const total =
    Number.isFinite(headerLength) && headerLength > 0
      ? headerLength
      : expectedBytes && expectedBytes > 0
        ? expectedBytes
        : undefined;

  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;

  const startedAt = performance.now();
  let lastEmit = 0;

  const emit = (force = false) => {
    const now = performance.now();
    if (!force && now - lastEmit < 120) return;
    lastEmit = now;
    const elapsed = Math.max((now - startedAt) / 1000, 0.001);
    const speedBps = received / elapsed;
    const percent = total ? Math.min(100, (received / total) * 100) : undefined;
    const etaSeconds =
      total && speedBps > 0 ? Math.max(0, (total - received) / speedBps) : undefined;
    onProgress?.({ received, total, percent, speedBps, etaSeconds });
  };

  emit(true);

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value as Uint8Array<ArrayBuffer>);
      received += value.byteLength;
      emit();
    }
  }

  emit(true);

  const blob = new Blob(chunks, {
    type: response.headers.get("content-type") ?? "application/octet-stream",
  });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);

  return received;
}
