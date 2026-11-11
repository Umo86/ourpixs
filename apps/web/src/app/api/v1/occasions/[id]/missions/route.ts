import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, readQuery, planFeature, planLimit } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { planOf } from "@/lib/occasion";
import { missionLeaderboard } from "@/lib/queries";
import { toMission } from "@/lib/serializers";

const MAX_MISSIONS = 20;

async function payload(occasionId: string) {
  const [missions, doneCounts, leaderboard] = await Promise.all([
    db.select().from(schema.missions).where(eq(schema.missions.occasionId, occasionId)).orderBy(asc(schema.missions.sortOrder), asc(schema.missions.title)),
    db.select({ missionId: schema.media.missionId, n: sql<number>`count(distinct ${schema.media.guestId})::int` })
      .from(schema.media)
      .where(and(eq(schema.media.occasionId, occasionId), eq(schema.media.status, "uploaded"), sql`${schema.media.visibility} <> 'deleted'`, sql`${schema.media.missionId} is not null`))
      .groupBy(schema.media.missionId),
    missionLeaderboard(occasionId),
  ]);
  const counts = new Map(doneCounts.map((d) => [d.missionId, Number(d.n)]));
  // `doneCount` and `leaderboard` are additive fields for the host dashboard.
  return { missions: missions.map((m) => ({ ...toMission(m), doneCount: counts.get(m.id) ?? 0 })), leaderboard };
}

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const { occasion } = await requireMember(id);
  return json(await payload(occasion.id));
});

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id);
  if (!planOf(occasion).missions) throw planFeature("photo missions");
  const { title } = await readJson(req, z.object({ title: z.string().trim().min(2).max(120) }));
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.missions).where(eq(schema.missions.occasionId, occasion.id));
  if (Number(n) >= MAX_MISSIONS) throw planLimit(`Up to ${MAX_MISSIONS} missions`);
  await db.insert(schema.missions).values({ occasionId: occasion.id, title, sortOrder: Number(n) });
  return json(await payload(occasion.id));
});

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id);
  const { missionId } = readQuery(req, z.object({ missionId: z.string().uuid() }));
  await db.delete(schema.missions).where(and(eq(schema.missions.id, missionId), eq(schema.missions.occasionId, occasion.id)));
  return json(await payload(occasion.id));
});
