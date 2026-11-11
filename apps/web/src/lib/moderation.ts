import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { presignGet } from "./storage";

type MediaRow = typeof schema.media.$inferSelect;

/** Variance-of-Laplacian below this (on the client's ≤320px greyscale) counts as blurry. */
export const BLUR_THRESHOLD = 20;
/** Max Hamming distance between 64-bit dHashes to call two shots duplicates. */
export const DUP_DISTANCE = 4;

/** Cheap flags from client-computed signals. Duplicate = near-identical to another live item in the same event. */
export async function signalFlags(m: Pick<MediaRow, "id" | "occasionId" | "phash" | "blurScore" | "kind">): Promise<string[]> {
  const flags: string[] = [];
  if (m.kind === "photo" && m.blurScore != null && m.blurScore < BLUR_THRESHOLD) flags.push("blurry");
  if (m.phash && /^[0-9a-f]{16}$/.test(m.phash)) {
    const [dup] = await db.select({ id: schema.media.id }).from(schema.media).where(and(
      eq(schema.media.occasionId, m.occasionId), ne(schema.media.id, m.id), eq(schema.media.status, "uploaded"),
      ne(schema.media.visibility, "deleted"), sql`${schema.media.phash} ~ '^[0-9a-f]{16}$'`,
      sql`bit_count(('x' || ${schema.media.phash})::bit(64) # ('x' || ${m.phash})::bit(64)) <= ${DUP_DISTANCE}`,
    )).limit(1);
    if (dup) flags.push("duplicate");
  }
  return flags;
}

/**
 * OpenAI moderation (free endpoint, omni-moderation-latest) on the display/thumb image.
 * Only runs when OPENAI_API_KEY is set; failures are ignored (never blocks an upload).
 */
export async function nsfwCheck(m: Pick<MediaRow, "keyDisplay" | "keyThumb">): Promise<boolean> {
  const key = process.env.OPENAI_API_KEY;
  const imgKey = m.keyDisplay || m.keyThumb;
  if (!key || !imgKey) return false;
  try {
    const url = await presignGet(imgKey);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input: [{ type: "image_url", image_url: { url } }] }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return false;
    const data = (await res.json()) as { results?: { flagged?: boolean; categories?: Record<string, boolean> }[] };
    const r = data.results?.[0];
    if (!r) return false;
    const c = r.categories || {};
    return !!(c["sexual"] || c["sexual/minors"] || c["violence/graphic"] || c["self-harm/graphic"] || (r.flagged && (c["violence"] || c["self-harm"])));
  } catch {
    return false;
  }
}
