import type { SupportedPlatform } from "@/services/aioDownloader/types";

export type HistoryEntry = {
  id: string;
  url: string;
  platform: SupportedPlatform;
  platformLabel: string;
  title?: string;
  thumbnailUrl?: string;
  timestamp: number;
  status: "ready" | "failed";
};

const KEY = "griezboy.history.v1";
const LIMIT = 40;
export const HISTORY_EVENT = "griezboy:history";

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<HistoryEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.url === "string" &&
    typeof entry.platform === "string" &&
    typeof entry.timestamp === "number"
  );
}

/** Activity is local-only. Nothing here is ever transmitted. */
export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, LIMIT);
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
  } catch {
    /* quota or private mode */
  }
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}

export function addHistory(entry: Omit<HistoryEntry, "id" | "timestamp">): void {
  if (typeof window === "undefined") return;
  const current = readHistory().filter(
    (item) => !(item.url === entry.url && item.status === entry.status),
  );
  write([
    {
      ...entry,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    },
    ...current,
  ]);
}

export function removeHistory(id: string): void {
  if (typeof window === "undefined") return;
  write(readHistory().filter((entry) => entry.id !== id));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}
