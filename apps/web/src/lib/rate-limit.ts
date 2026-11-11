import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ApiError } from "./http";

/**
 * Postgres token bucket (table `rate_limits`), one atomic upsert per call.
 * - `capacity` tokens max, refilled at `perSeconds` seconds for a full bucket.
 * - Stored tokens are encoded: >= 0 means "last call allowed, n left"; < 0 means "last call denied, -(n+1) left".
 *   This lets a single INSERT ... ON CONFLICT ... RETURNING tell us whether the call was allowed.
 * - `updated_at` only advances by the time that produced whole tokens, so slow steady traffic still refills.
 */
export async function consume(key: string, capacity: number, perSeconds: number, cost = 1): Promise<{ allowed: boolean; remaining: number }> {
  const refill = capacity / perSeconds; // tokens per second
  const cur = sql`(case when rate_limits.tokens < 0 then -(rate_limits.tokens + 1) else rate_limits.tokens end)`;
  const added = sql`floor(extract(epoch from (now() - rate_limits.updated_at)) * ${refill}::float8)::int`;
  const n = sql`least(${capacity}::int, ${cur} + ${added})`;
  const initial = capacity >= cost ? capacity - cost : -(capacity + 1);
  const rows = await db.execute<{ tokens: number }>(sql`
    insert into rate_limits (key, tokens, updated_at) values (${key}, ${initial}, now())
    on conflict (key) do update set
      tokens = case when ${n} >= ${cost}::int then ${n} - ${cost}::int else -(${n} + 1) end,
      updated_at = case
        when ${cur} + ${added} >= ${capacity}::int then now()
        when ${added} > 0 then rate_limits.updated_at + make_interval(secs => ${added} / ${refill}::float8)
        else rate_limits.updated_at end
    returning tokens`);
  const t = Number(rows.rows[0]?.tokens ?? 0);
  return t >= 0 ? { allowed: true, remaining: t } : { allowed: false, remaining: -(t + 1) };
}

/** Throws 429 `rate_limited` when the bucket is empty. */
export async function limit(key: string, capacity: number, perSeconds: number, cost = 1): Promise<void> {
  const r = await consume(key, capacity, perSeconds, cost);
  if (!r.allowed) throw new ApiError(429, "rate_limited", "Too many requests. Please wait a moment and try again.");
}

/** Throws 429 if no tokens are left, without spending one (used before checking a secret, e.g. a PIN). */
export async function ensureTokens(key: string, capacity: number, perSeconds: number): Promise<void> {
  const r = await consume(key, capacity, perSeconds, 0);
  if (r.remaining < 1) throw new ApiError(429, "rate_limited", "Too many attempts. Please wait a few minutes.");
}
