import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { occasionStats } from "@/lib/queries";
import { keysForOccasion, occasionPayload, patchSchema, updateOccasion } from "@/lib/occasion-service";
import { deleteObjects } from "@/lib/storage";

export const maxDuration = 60;

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const { occasion, role } = await requireMember(id);
  const [payload, stats] = await Promise.all([occasionPayload(occasion, role), occasionStats(occasion)]);
  return json({ occasion: payload, stats });
});

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { occasion, role } = await requireMember(id);
  const body = await readJson(req, patchSchema);
  const updated = await updateOccasion(occasion, body);
  return json({ occasion: await occasionPayload(updated, role) });
});

export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  const { occasion } = await requireMember(id, { owner: true });
  await deleteObjects(await keysForOccasion(occasion.id));
  await db.delete(schema.occasions).where(eq(schema.occasions.id, occasion.id));
  return json({ ok: true });
});
