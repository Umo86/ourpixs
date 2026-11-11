import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, clientIp } from "@/lib/http";
import { getGuest, occasionBySlug, requirePinAccess } from "@/lib/guest";
import { missionLeaderboard } from "@/lib/queries";
import { toMission } from "@/lib/serializers";

export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await getGuest(o);
  await requirePinAccess(o, clientIp(req), guest);
  const live = and(eq(schema.media.occasionId, o.id), eq(schema.media.status, "uploaded"), sql`${schema.media.visibility} <> 'deleted'`, sql`${schema.media.missionId} is not null`);
  const [missions, counts, mine, leaderboard] = await Promise.all([
    db.select().from(schema.missions).where(eq(schema.missions.occasionId, o.id)).orderBy(asc(schema.missions.sortOrder)),
    db.select({ missionId: schema.media.missionId, n: sql<number>`count(distinct ${schema.media.guestId})::int` }).from(schema.media).where(live).groupBy(schema.media.missionId),
    guest ? db.selectDistinct({ missionId: schema.media.missionId }).from(schema.media).where(and(live, eq(schema.media.guestId, guest.id))) : Promise.resolve([]),
    missionLeaderboard(o.id, 50),
  ]);
  const doneSet = new Set(mine.map((m) => m.missionId));
  const countMap = new Map(counts.map((c) => [c.missionId, Number(c.n)]));
  const rank = guest ? leaderboard.findIndex((l) => l.guestId === guest.id) : -1;
  return json({
    missions: missions.map((m) => ({ ...toMission(m), done: doneSet.has(m.id), doneCount: countMap.get(m.id) ?? 0 })),
    // Additive: top snappers and this guest's position.
    leaderboard: leaderboard.slice(0, 10).map((l) => ({ guestName: l.guestName, done: l.done })),
    me: guest ? { rank: rank >= 0 ? rank + 1 : null, done: doneSet.size } : null,
  });
});
