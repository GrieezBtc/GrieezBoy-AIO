import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Server-side response cache. Holds ONLY normalized, non-personal payloads
 * (public media metadata). No user history is ever stored server side.
 */
export const responseCache = pgTable(
  "response_cache",
  {
    key: text("key").primaryKey(),
    scope: text("scope").notNull(),
    payload: jsonb("payload").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("response_cache_scope_idx").on(table.scope)],
);

export type ResponseCacheRow = typeof responseCache.$inferSelect;
