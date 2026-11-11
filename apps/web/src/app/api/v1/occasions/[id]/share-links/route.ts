import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, readQuery, planFeature } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { planOf } from "@/lib/occasion";
import { toShareLink } from "@/lib/serializers";
import { randomSlug } from "@/lib/slug";

type OccasionRow = typeof schema.occasions.$inferSelect;

async function list(o: OccasionRow) {
  const rows = await db.select().from(schema.shareLinks).where(eq(schema.shareLinks.occasionId, o.id)).orderBy(desc(schema.shareLinks.createdAt));
  return { links: rows.map((l) => toShareLink(o, l)) };
}

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const { occasion } = await requireMember(id);
  return json(await list(occasion));
});

const body = z.object({
  label: z.string().trim().max(80).optional().nullable(),
  scope: z.enum(["view", "view_upload"]).default("view"),
  /** Additive: optional expiry in days. */
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id);
  if (!planOf(occasion).shareLinks) throw planFeature("share links");
  const b = await readJson(req, body);
  await db.insert(schema.shareLinks).values({
    occasionId: occasion.id, token: randomSlug(24), scope: b.scope, label: b.label || null,
    expiresAt: b.expiresInDays ? new Date(Date.now() + b.expiresInDays * 86400_000) : occasion.storageExpiresAt,
  });
  return json(await list(occasion), { status: 201 });
});

/** Additive: DELETE ?linkId= revokes a link. */
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id);
  const { linkId } = readQuery(req, z.object({ linkId: z.string().uuid() }));
  await db.delete(schema.shareLinks).where(and(eq(schema.shareLinks.id, linkId), eq(schema.shareLinks.occasionId, occasion.id)));
  return json(await list(occasion));
});
