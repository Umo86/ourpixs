import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { ref } from "@/lib/sql-ref";

/** Guests of an event with upload counts (for moderation / blocking). */
export const GET = route<{ id: string }>(async (_req, { id }) => {
  const { occasion } = await requireMember(id);
  const rows = await db.select({
    id: schema.guests.id, displayName: schema.guests.displayName, createdAt: schema.guests.createdAt, blockedAt: schema.guests.blockedAt,
    uploads: sql<number>`(select count(*)::int from media m where m.guest_id = ${ref(schema.guests.id)} and m.status = 'uploaded' and m.visibility <> 'deleted')`,
  }).from(schema.guests).where(eq(schema.guests.occasionId, occasion.id)).orderBy(desc(schema.guests.createdAt)).limit(2000);
  return json({
    guests: rows.map((g) => ({ id: g.id, displayName: g.displayName, uploads: Number(g.uploads), blocked: !!g.blockedAt, joinedAt: g.createdAt.toISOString() })),
  });
});
