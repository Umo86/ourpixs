import "server-only";
import { z } from "zod";
import { and, eq, ne, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { OCCASIONS, SUBSCRIPTION, type Brand, type OccasionType } from "./config";
import { ApiError, badRequest, planLimit } from "./http";
import { brandLocale } from "./occasion";
import { loadDays, occasionExtras } from "./queries";
import { coverUrlFor, toOccasion, toSummary } from "./serializers";
import { randomSlug, vanityError } from "./slug";
import { hashSecret } from "./crypto";
import { accessForOccasion, accessForOwners, assertCanCreateEvents, assertWritable, computeAccess, loadOwnerBilling, trialEndFrom, type Access } from "./access";

type OccasionRow = typeof schema.occasions.$inferSelect;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDate = z.iso.datetime({ offset: true });
const THEMES = ["noir", "royal", "ivory", "dusk", "mono", "blush"] as const;
const TYPES = Object.keys(OCCASIONS) as [OccasionType, ...OccasionType[]];
const MAX_DAYS_STORED = SUBSCRIPTION.features.maxDays;

export const createSchema = z.object({
  type: z.enum(TYPES),
  title: z.string().trim().min(1).max(120),
  honorees: z.array(z.string().trim().min(1).max(60)).max(4).default([]),
  startsOn: dateStr.optional().nullable(),
  venueName: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  theme: z.enum(THEMES).optional(),
  days: z.array(z.object({ name: z.string().trim().min(1).max(60), date: dateStr.optional().nullable() })).max(MAX_DAYS_STORED).optional(),
});

export const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  honorees: z.array(z.string().trim().min(1).max(60)).max(4).optional(),
  startsOn: dateStr.nullable().optional(),
  venueName: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  theme: z.enum(THEMES).optional(),
  approvalMode: z.boolean().optional(),
  revealMode: z.enum(["live", "next_morning"]).optional(),
  revealAt: isoDate.nullable().optional(),
  uploadOpensAt: isoDate.nullable().optional(),
  uploadClosesAt: isoDate.nullable().optional(),
  pin: z.string().trim().regex(/^\d{4,8}$/, "PIN must be 4–8 digits").nullable().optional(),
  disposableShots: z.number().int().min(1).max(100).nullable().optional(),
  /** Additive: edit days (existing ids are updated, new ones created, missing ones removed). */
  days: z.array(z.object({
    id: z.string().uuid().optional(), name: z.string().trim().min(1).max(60), date: dateStr.nullable().optional(),
    uploadOpensAt: isoDate.nullable().optional(), uploadClosesAt: isoDate.nullable().optional(),
  })).min(1).max(MAX_DAYS_STORED).optional(),
  /** Additive: custom link name, e.g. "elif-and-can". null removes it (the random link always works). */
  vanitySlug: z.string().trim().toLowerCase().max(40).nullable().optional(),
  /** Additive: pick the album cover from a photo. */
  coverMediaId: z.string().uuid().nullable().optional(),
});

/**
 * Creates an event owned by `hostId`. The host's first event starts their free trial (no card).
 * Returns `trialStarted: true` when this call started it.
 */
export async function createOccasion(hostId: string, brand: Brand, input: z.infer<typeof createSchema>) {
  const billing = await loadOwnerBilling(hostId);
  if (!billing) throw new ApiError(401, "unauthorized", "Sign in required");
  assertCanCreateEvents(computeAccess(billing));
  const id = crypto.randomUUID();
  const loc = brandLocale({ brand });
  const days = input.days?.length
    ? input.days
    : [{ name: OCCASIONS[input.type].days[0]![loc], date: input.startsOn ?? null }];
  const values = {
    id, ownerId: hostId, brand, type: input.type, title: input.title, honorees: input.honorees,
    startsOn: input.startsOn ?? null, venueName: input.venueName || null, city: input.city || null,
    theme: input.theme ?? "noir",
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db.batch([
        db.insert(schema.occasions).values({ ...values, slug: randomSlug(10) }),
        db.insert(schema.occasionMembers).values({ occasionId: id, hostId, role: "owner" }),
        db.insert(schema.days).values(days.map((d, i) => ({ occasionId: id, name: d.name, date: d.date ?? null, sortOrder: i }))),
      ]);
      break;
    } catch (e) {
      // Retry only on the (astronomically unlikely) slug collision.
      if (attempt === 2 || !String((e as Error).message).includes("slug")) throw e;
    }
  }
  // First event: start the trial (conditional, so two parallel creates can't restart it).
  let trialStarted = false;
  if (billing.planStatus === "none") {
    const now = new Date();
    const started = await db.update(schema.hosts)
      .set({ planStatus: "trialing", trialStartedAt: now, trialEndsAt: trialEndFrom(now) })
      .where(and(eq(schema.hosts.id, hostId), eq(schema.hosts.planStatus, "none"))).returning({ id: schema.hosts.id });
    trialStarted = started.length > 0;
  }
  const [o] = await db.select().from(schema.occasions).where(eq(schema.occasions.id, id));
  return { occasion: o!, trialStarted };
}

export async function updateOccasion(o: OccasionRow, p: z.infer<typeof patchSchema>) {
  assertWritable(await accessForOccasion(o));
  const set: Partial<typeof schema.occasions.$inferInsert> = {};
  if (p.title !== undefined) set.title = p.title;
  if (p.honorees !== undefined) set.honorees = p.honorees;
  if (p.startsOn !== undefined) set.startsOn = p.startsOn;
  if (p.venueName !== undefined) set.venueName = p.venueName || null;
  if (p.city !== undefined) set.city = p.city || null;
  if (p.theme !== undefined) set.theme = p.theme;
  if (p.approvalMode !== undefined) set.approvalMode = p.approvalMode;
  if (p.revealMode !== undefined) set.revealMode = p.revealMode;
  if (p.revealAt !== undefined) set.revealAt = p.revealAt ? new Date(p.revealAt) : null;
  if (p.uploadOpensAt !== undefined) set.uploadOpensAt = p.uploadOpensAt ? new Date(p.uploadOpensAt) : null;
  if (p.uploadClosesAt !== undefined) set.uploadClosesAt = p.uploadClosesAt ? new Date(p.uploadClosesAt) : null;
  const opens = set.uploadOpensAt !== undefined ? set.uploadOpensAt : o.uploadOpensAt;
  const closes = set.uploadClosesAt !== undefined ? set.uploadClosesAt : o.uploadClosesAt;
  if (opens && closes && opens >= closes) throw badRequest("Uploads must open before they close");
  if (p.pin !== undefined) set.pinHash = p.pin ? await hashSecret(p.pin) : null;
  if (p.disposableShots !== undefined) set.disposableShots = p.disposableShots;
  if (p.coverMediaId !== undefined) {
    if (p.coverMediaId === null) set.coverKey = null;
    else {
      const [m] = await db.select().from(schema.media)
        .where(and(eq(schema.media.id, p.coverMediaId), eq(schema.media.occasionId, o.id))).limit(1);
      if (!m) throw badRequest("Unknown photo");
      set.coverKey = m.keyDisplay ?? m.keyThumb ?? m.keyOriginal;
    }
  }
  if (p.vanitySlug !== undefined) {
    if (p.vanitySlug === null || p.vanitySlug === "") set.vanitySlug = null;
    else {
      const err = vanityError(p.vanitySlug);
      if (err) throw new ApiError(400, err === "reserved" ? "slug_reserved" : "slug_invalid", err === "reserved" ? "That link name is reserved" : "Use 3–40 lowercase letters, numbers or hyphens");
      const [clash] = await db.select({ id: schema.occasions.id }).from(schema.occasions)
        .where(and(ne(schema.occasions.id, o.id), or(eq(schema.occasions.vanitySlug, p.vanitySlug), sql`lower(${schema.occasions.slug}) = ${p.vanitySlug}`))).limit(1);
      if (clash) throw new ApiError(409, "slug_taken", "That link name is taken");
      set.vanitySlug = p.vanitySlug;
    }
  }
  if (Object.keys(set).length) await db.update(schema.occasions).set(set).where(eq(schema.occasions.id, o.id));

  if (p.days) {
    if (p.days.length > MAX_DAYS_STORED) throw planLimit("Too many days");
    const existing = await loadDays(o.id);
    const keepIds = p.days.map((d) => d.id).filter((x): x is string => !!x && existing.some((e) => e.id === x));
    if (existing.length) {
      await db.delete(schema.days).where(and(eq(schema.days.occasionId, o.id),
        keepIds.length ? notInArray(schema.days.id, keepIds) : undefined));
    }
    for (const [i, d] of p.days.entries()) {
      const opens = d.uploadOpensAt ? new Date(d.uploadOpensAt) : null;
      const closes = d.uploadClosesAt ? new Date(d.uploadClosesAt) : null;
      if (opens && closes && opens >= closes) throw badRequest("Uploads must open before they close");
      const values = { name: d.name, date: d.date ?? null, sortOrder: i, uploadOpensAt: opens, uploadClosesAt: closes };
      if (d.id && keepIds.includes(d.id)) {
        await db.update(schema.days).set(values).where(and(eq(schema.days.id, d.id), eq(schema.days.occasionId, o.id)));
      } else {
        await db.insert(schema.days).values({ occasionId: o.id, ...values });
      }
    }
  }
  const [fresh] = await db.select().from(schema.occasions).where(eq(schema.occasions.id, o.id));
  return fresh!;
}

/** Full Occasion payload for a member (with `access` from the owner's subscription). */
export async function occasionPayload(o: OccasionRow, role: "owner" | "cohost", access?: Access) {
  const [days, extras, a] = await Promise.all([loadDays(o.id), occasionExtras([o.id]), access ?? accessForOccasion(o)]);
  const ex = extras.get(o.id);
  return toOccasion(o, days, {
    coverUrl: await coverUrlFor(ex?.coverKey ?? null), mediaCount: ex?.mediaCount ?? 0, guestCount: ex?.guestCount ?? 0, role,
  }, a);
}

/** Occasion ids a host belongs to with their role. */
export async function memberships(hostId: string) {
  return db.select({ occasion: schema.occasions, role: schema.occasionMembers.role })
    .from(schema.occasionMembers)
    .innerJoin(schema.occasions, eq(schema.occasions.id, schema.occasionMembers.occasionId))
    .where(eq(schema.occasionMembers.hostId, hostId));
}

export async function summariesFor(hostId: string) {
  const rows = await memberships(hostId);
  const [extras, access] = await Promise.all([occasionExtras(rows.map((r) => r.occasion.id)), accessForOwners(rows.map((r) => r.occasion.ownerId))]);
  const list = await Promise.all(rows.map(async (r) => {
    const ex = extras.get(r.occasion.id);
    return {
      row: r.occasion,
      summary: toSummary(r.occasion, {
        coverUrl: await coverUrlFor(ex?.coverKey ?? null), mediaCount: ex?.mediaCount ?? 0, guestCount: ex?.guestCount ?? 0, role: r.role as "owner" | "cohost",
      }, access.get(r.occasion.ownerId)!),
    };
  }));
  // Newest event date first; undated by creation.
  list.sort((a, b) => (b.row.startsOn || b.row.createdAt.toISOString()).localeCompare(a.row.startsOn || a.row.createdAt.toISOString()));
  return list.map((l) => l.summary);
}

export async function keysForOccasion(occasionId: string) {
  const media = await db.select({ a: schema.media.keyOriginal, b: schema.media.keyDisplay, c: schema.media.keyThumb })
    .from(schema.media).where(eq(schema.media.occasionId, occasionId));
  const msgs = await db.select({ k: schema.messages.mediaKey }).from(schema.messages).where(eq(schema.messages.occasionId, occasionId));
  // Custom covers live under o/{id}/cover/ and aren't media rows.
  const [occ] = await db.select({ k: schema.occasions.coverKey }).from(schema.occasions).where(eq(schema.occasions.id, occasionId));
  const cover = occ?.k?.startsWith(`o/${occasionId}/cover/`) ? occ.k : null;
  return [...media.flatMap((m) => [m.a, m.b, m.c]), ...msgs.map((m) => m.k), cover].filter((k): k is string => !!k);
}

