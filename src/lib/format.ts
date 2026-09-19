export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const decimals = value >= 100 || unit === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

export function parseFileSize(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return n > 0 ? n : undefined;
  }
  const match = trimmed.match(
    /^([\d.,]+)\s*(b|bytes|kb|kib|mb|mib|gb|gib|tb)\b/i,
  );
  if (!match) return undefined;
  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const factor: Record<string, number> = {
    b: 1,
    bytes: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    gb: 1024 ** 3,
    gib: 1024 ** 3,
    tb: 1024 ** 4,
  };
  return Math.round(amount * factor[match[2].toLowerCase()]);
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "";
  const seconds = Math.round(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Accepts seconds, ms-ish numbers, "03:21", "PT3M21S" or "210s". */
export function parseDurationSeconds(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 86_400 ? Math.round(value / 1000) : Math.round(value);
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseDurationSeconds(Number(trimmed));
  }
  const clock = trimmed.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (clock) {
    const h = clock[1] ? Number(clock[1]) : 0;
    return h * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  }
  const iso = trimmed.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (iso && (iso[1] || iso[2] || iso[3])) {
    return (
      Number(iso[1] ?? 0) * 3600 +
      Number(iso[2] ?? 0) * 60 +
      Math.round(Number(iso[3] ?? 0))
    );
  }
  const suffixed = trimmed.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds)$/i);
  if (suffixed) return Math.round(Number(suffixed[1]));

  const minutes = trimmed.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)$/i);
  if (minutes) return Math.round(Number(minutes[1]) * 60);

  const hours = trimmed.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)$/i);
  if (hours) return Math.round(Number(hours[1]) * 3600);

  return undefined;
}

export function formatCount(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "";
  }
  if (value < 1000) return String(Math.round(value));
  const units = [
    { limit: 1_000_000_000, suffix: "B" },
    { limit: 1_000_000, suffix: "M" },
    { limit: 1000, suffix: "K" },
  ];
  for (const unit of units) {
    if (value >= unit.limit) {
      const n = value / unit.limit;
      return `${n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "")}${unit.suffix}`;
    }
  }
  return String(value);
}

export function relativeTime(timestamp: number | string): string {
  const time =
    typeof timestamp === "number" ? timestamp : Date.parse(String(timestamp));
  if (!Number.isFinite(time)) return "";
  const diff = Date.now() - time;
  const abs = Math.abs(diff);
  const units: Array<[number, string]> = [
    [60_000, "s"],
    [3_600_000, "m"],
    [86_400_000, "h"],
    [2_592_000_000, "d"],
    [31_536_000_000, "mo"],
  ];
  if (abs < 60_000) return "just now";
  for (let i = 0; i < units.length; i += 1) {
    const [limit, suffix] = units[i];
    if (abs < limit) {
      const divisor = i === 0 ? 1000 : units[i - 1][0];
      return `${Math.floor(abs / divisor)}${suffix} ago`;
    }
  }
  return `${Math.floor(abs / 31_536_000_000)}y ago`;
}
