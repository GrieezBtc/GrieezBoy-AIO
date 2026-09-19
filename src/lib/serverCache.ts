import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { responseCache } from "@/db/schema";

/**
 * Best-effort cache for normalized, non-personal payloads.
 * Any database failure degrades silently - the API still works.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const rows = await db
      .select()
      .from(responseCache)
      .where(and(eq(responseCache.key, key), gt(responseCache.expiresAt, new Date())))
      .limit(1);
    if (!rows.length) return null;
    return rows[0].payload as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  scope: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await db
      .insert(responseCache)
      .values({ key, scope, payload: payload as object, expiresAt })
      .onConflictDoUpdate({
        target: responseCache.key,
        set: { payload: payload as object, expiresAt, scope },
      });
  } catch {
    /* cache is optional */
  }
}
