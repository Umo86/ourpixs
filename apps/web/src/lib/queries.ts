import "server-only";
import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Stats } from "./api-types";
import { badRequest } from "./http";

const { media, guests, occasions, days, messages } = schema;
type OccasionRow = typeof schema.occasions.$inferSelect;

export const PAGE_SIZE = 60;

/** Keyset cursor over (created_at, id). The timestamp keeps Postgres' microsecond text form so equal-timestamp batches don't skip rows. */
export function encodeCursor(ts: string, id: string) {
  return Buffer.from(`${ts}|${id}`).toString("base64url");
}
export function decodeCursor(c: string): { ts: string; id: string } | { offset: number } {
  const raw = Buffer.from(c, "base64url").toString();
  if (raw.startsWith("o:")) {
    const n = Number(raw.slice(2));
    if (!Number.isInteger(n) || n < 0 || n > 100000) throw badRequest("Bad cursor");
    return { offset: n };
  }
  const [ts, id] = raw.split("|");
  if (!ts || !id || !/^[0-9a-f-]{36}$/i.test(id) || !/^\d{4}-\d\d-\d\d[ T][\d:.]+([+-]\d\d(:?\d\d)?|Z)?$/.test(ts)) throw badRequest("Bad cursor");
  return { ts, id };
}
export const offsetCursor = (n: number) => Buffer.from(`o:${n}`).toString("base64url");

export const tsText = sql<string>`${media.createdAt}::text`;

export function cursorCondition(c: string | undefined): { where?: SQL; offset: number } {
  if (!c) return { offset: 0 };
  const d = decodeCursor(c);
  if ("offset" in d) return { offset: d.offset };
  return { where: sql`(${media.createdAt}, ${media.id}) < (${d.ts}::timestamptz, ${d.id}::uuid)`, offset: 0 };
}

export type MediaQuery = {
  where: SQL[];
  cursor?: string;
  sort?: "new" | "top";
  limit?: number;
  guestIdForReaction?: string;
};

/** Generic media page: rows with uploader name, optional reactedByMe for a guest, and next cursor. */
export async function mediaPage(q: MediaQuery) {
  const limit = q.limit ?? PAGE_SIZE;
  const c = q.sort === "top" ? { offset: q.cursor ? (decodeCursor(q.cursor) as { offset: number }).offset ?? 0 : 0 } : cursorCondition(q.cursor);
  const where = and(...q.where, ...("where" in c && c.where ? [c.where] : []));
  const reacted = q.guestIdForReaction
    ? sql<boolean>`exists(select 1 from reactions r where r.media_id = ${media.id} and r.guest_id = ${q.guestIdForReaction})`
    : sql<boolean>`false`;
  const rows = await db
    .select({ media, guestName: guests.displayName, ts: tsText, reactedByMe: reacted })
    .from(media)
    .leftJoin(guests, eq(guests.id, media.guestId))
    .where(where)
    .orderBy(...(q.sort === "top" ? [desc(media.reactionCount), desc(media.createdAt), desc(media.id)] : [desc(media.createdAt), desc(media.id)]))
    .limit(limit + 1)
    .offset(c.offset);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor = !hasMore || !last ? null : q.sort === "top" ? offsetCursor(c.offset + limit) : encodeCursor(last.ts, last.media.id);
  return { rows: page, nextCursor };
}

/** Uploaded and not deleted. */
export const liveMedia = (occasionId: string) => [eq(media.occasionId, occasionId), eq(media.status, "uploaded"), ne(media.visibility, "deleted")];

export async function loadDays(occasionId: string) {
  return db.select().from(days).where(eq(days.occasionId, occasionId)).orderBy(asc(days.sortOrder));
}

export async function occasionExtras(ids: string[]) {
  if (!ids.length) return new Map<string, { mediaCount: number; guestCount: number; coverKey: string | null }>();
  const rows = await db
    .select({
      id: occasions.id,
      mediaCount: sql<number>`(select count(*)::int from media m where m.occasion_id = ${occasions.id} and m.status = 'uploaded' and m.visibility <> 'deleted')`,
      guestCount: sql<number>`(select count(*)::int from guests g where g.occasion_id = ${occasions.id})`,
      coverKey: sql<string | null>`coalesce(${occasions.coverKey}, (select coalesce(m.key_display, m.key_thumb) from media m
        where m.occasion_id = ${occasions.id} and m.status = 'uploaded' and m.visibility = 'visible' and m.approved = true
          and (m.key_display is not null or m.key_thumb is not null)
        order by m.favourite desc, m.reaction_count desc, m.created_at desc limit 1))`,
    })
    .from(occasions)
    .where(inArray(occasions.id, ids));
  return new Map(rows.map((r) => [r.id, { mediaCount: Number(r.mediaCount), guestCount: Number(r.guestCount), coverKey: r.coverKey }]));
}

export async function occasionStats(o: OccasionRow): Promise<Stats> {
  const id = o.id;
  const [r] = await db.select({
    guests: sql<number>`(select count(*)::int from guests where occasion_id = ${id})`,
    photos: sql<number>`(select count(*)::int from media where occasion_id = ${id} and status = 'uploaded' and visibility <> 'deleted' and kind = 'photo')`,
    videos: sql<number>`(select count(*)::int from media where occasion_id = ${id} and status = 'uploaded' and visibility <> 'deleted' and kind = 'video')`,
    messages: sql<number>`(select count(*)::int from messages where occasion_id = ${id})`,
    bytes: sql<number>`(select coalesce(sum(bytes), 0)::bigint from media where occasion_id = ${id} and status = 'uploaded' and visibility <> 'deleted')`,
    pending: sql<number>`(select count(*)::int from media where occasion_id = ${id} and status = 'uploaded' and visibility = 'visible' and approved = false)`,
  }).from(sql`(select 1) as one`);
  return {
    guests: Number(r?.guests ?? 0), photos: Number(r?.photos ?? 0), videos: Number(r?.videos ?? 0),
    messages: Number(r?.messages ?? 0), bytes: Number(r?.bytes ?? 0), pendingApproval: Number(r?.pending ?? 0),
  };
}

/** Count of media that counts towards the plan's maxMedia (anything not deleted, including in-flight uploads). */
export async function mediaCountForLimit(occasionId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(media)
    .where(and(eq(media.occasionId, occasionId), ne(media.visibility, "deleted"), ne(media.status, "failed"), ne(media.kind, "voice")));
  return Number(r?.n ?? 0);
}

export async function messagesWithNames(occasionId: string) {
  return db.select({ message: messages, guestName: guests.displayName })
    .from(messages).leftJoin(guests, eq(guests.id, messages.guestId))
    .where(eq(messages.occasionId, occasionId)).orderBy(desc(messages.createdAt)).limit(500);
}

/** Leaderboard: guests by number of distinct missions completed. */
export async function missionLeaderboard(occasionId: string, limit = 10) {
  const rows = await db.select({
    guestId: media.guestId,
    guestName: guests.displayName,
    done: sql<number>`count(distinct ${media.missionId})::int`,
  }).from(media).innerJoin(guests, eq(guests.id, media.guestId))
    .where(and(...liveMedia(occasionId), sql`${media.missionId} in (select id from missions where occasion_id = ${occasionId})`))
    .groupBy(media.guestId, guests.displayName)
    .orderBy(sql`count(distinct ${media.missionId}) desc`, asc(guests.displayName))
    .limit(limit);
  return rows.map((r) => ({ guestId: r.guestId!, guestName: r.guestName, done: Number(r.done) }));
}
