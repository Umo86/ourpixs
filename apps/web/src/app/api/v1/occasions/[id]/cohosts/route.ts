import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, readQuery, planFeature, badRequest } from "@/lib/http";
import { normalizeEmail, requireMember } from "@/lib/auth";
import { planOf } from "@/lib/occasion";
import { emailConfigured, sendCohostInvite } from "@/lib/email";
import { limit } from "@/lib/rate-limit";
import { requestLocale } from "@/lib/request";

/** Additive endpoints for the web settings page: co-host list, invite by email, remove. */
async function list(occasionId: string) {
  const [members, invites] = await Promise.all([
    db.select({ hostId: schema.hosts.id, email: schema.hosts.email, name: schema.hosts.name, role: schema.occasionMembers.role })
      .from(schema.occasionMembers).innerJoin(schema.hosts, eq(schema.hosts.id, schema.occasionMembers.hostId))
      .where(eq(schema.occasionMembers.occasionId, occasionId)),
    db.select({ id: schema.cohostInvites.id, email: schema.cohostInvites.email }).from(schema.cohostInvites)
      .where(eq(schema.cohostInvites.occasionId, occasionId)),
  ]);
  return { members, invites };
}

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const { occasion } = await requireMember(id);
  return json(await list(occasion.id));
});

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { host, occasion } = await requireMember(id, { owner: true });
  if (!planOf(occasion).cohosts) throw planFeature("co-hosts");
  await limit(`invite:${host.id}`, 20, 86400);
  const { email: raw } = await readJson(req, z.object({ email: z.email().max(200) }));
  const email = normalizeEmail(raw);
  if (email === host.email) throw badRequest("You're already the owner");
  const [existing] = await db.select().from(schema.hosts).where(eq(schema.hosts.email, email)).limit(1);
  if (existing) {
    await db.insert(schema.occasionMembers).values({ occasionId: occasion.id, hostId: existing.id, role: "cohost" }).onConflictDoNothing();
  } else {
    const [dupe] = await db.select().from(schema.cohostInvites)
      .where(and(eq(schema.cohostInvites.occasionId, occasion.id), eq(schema.cohostInvites.email, email))).limit(1);
    if (!dupe) await db.insert(schema.cohostInvites).values({ occasionId: occasion.id, email });
  }
  if (emailConfigured()) {
    await sendCohostInvite(email, { inviter: host.name || host.email, title: occasion.title, locale: existing?.locale === "tr" ? "tr" : existing ? "en" : requestLocale(req), brand: occasion.brand })
      .catch((e) => console.error("[cohost] invite email failed", e));
  }
  return json(await list(occasion.id), { status: 201 });
});

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id, { owner: true });
  const q = readQuery(req, z.object({ hostId: z.string().uuid().optional(), inviteId: z.string().uuid().optional() }));
  if (q.hostId) {
    await db.delete(schema.occasionMembers).where(and(eq(schema.occasionMembers.occasionId, occasion.id),
      eq(schema.occasionMembers.hostId, q.hostId), eq(schema.occasionMembers.role, "cohost")));
  }
  if (q.inviteId) {
    await db.delete(schema.cohostInvites).where(and(eq(schema.cohostInvites.id, q.inviteId), eq(schema.cohostInvites.occasionId, occasion.id)));
  }
  return json(await list(occasion.id));
});
