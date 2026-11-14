import "server-only";
import { z } from "zod";
import { and, eq, ne, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_TIME_ZONE, FEATURES, OCCASIONS, type Brand, type Locale, type OccasionType } from "./config";
import { ApiError, badRequest, planLimit } from "./http";
import { brandLocale } from "./occasion";
import { loadDays, occasionExtras } from "./queries";
import { coverUrlFor, toOccasion, toSummary } from "./serializers";
import { randomSlug, vanityError } from "./slug";
import { hashSecret } from "./crypto";
import { deleteObjects, mediaFileKeys } from "./storage";
import { accessForOccasion, accessForOccasions, assertCanEditWindow, assertWritable, type Access } from "./access";
import { getSettings } from "./settings";
import { addMonths, defaultWindow, windowError } from "./window";
import { isTimeZone } from "./tz";
import { touchEnded } from "./package";

type OccasionRow = typeof schema.occasions.$inferSelect;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDate = z.iso.datetime({ offset: true });
const THEMES = ["noir", "royal", "ivory", "dusk", "mono", "blush"] as const;
const TYPES = Object.keys(OCCASIONS) as [OccasionType, ...OccasionType[]];
const MAX_DAYS_STORED = FEATURES.maxDays;
const timeZone = z.string().trim().max(64).refine(isTimeZone, "Unknown time zone");

export const createSchema = z.object({
  type: z.enum(TYPES),
  title: z.string().trim().min(1).max(120),
  honorees: z.array(z.string().trim().min(1).max(60)).max(4).default([]),
  startsOn: dateStr.optional().nullable(),
  venueName: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  theme: z.enum(THEMES).optional(),
  days: z.array(z.object({ name: z.string().trim().min(1).max(60), date: dateStr.optional().nullable() })).max(MAX_DAYS_STORED).optional(),
  /** Additive: the gallery window (defaults to the event date 10:00 for settings.windowDays days) and its time zone. */
  opensAt: isoDate.nullable().optional(),
  closesAt: isoDate.nullable().optional(),
  timeZone: timeZone.optional(),
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
  /** Additive: the gallery window (editable until it opens; closes_at − opens_at ≤ settings.windowDays) and its zone. */
  opensAt: isoDate.nullable().optional(),
  closesAt: isoDate.nullable().optional(),
  timeZone: timeZone.optional(),
});

/** API message for a window_* error code. */
function windowCodeMessage(code: string) {
  switch (code) {
    case "window_order": return "The gallery must open before it closes";
    case "window_too_long": return "The gallery can be live for up to the maximum number of days";
    case "window_past": return "The gallery's closing time has already passed";
    default: return "Pick when the gallery opens and when it closes";
  }
}

/**
 * Creates an event owned by `hostId`, in setup (not paid): the host can configure it, print QR cards and test-upload.
 * The gallery window defaults to the event date at 10:00 (event time zone) for settings.windowDays days.
 */
export async function createOccasion(hostId: string, brand: Brand, input: z.infer<typeof createSchema>, locale?: Locale) {
  const id = crypto.randomUUID();
  // Default day name in the host's language (BizimResimler hosts may be English or Turkish).
  const loc = locale ?? brandLocale({ brand });
  const days = input.days?.length
    ? input.days
    : [{ name: OCCASIONS[input.type].days[0]![loc], date: input.startsOn ?? null }];
  const s = await getSettings();
  const tz = input.timeZone ?? DEFAULT_TIME_ZONE;
  let window: { opensAt: Date | null; closesAt: Date | null } = { opensAt: null, closesAt: null };
  if (input.opensAt !== undefined || input.closesAt !== undefined) {
    window = { opensAt: input.opensAt ? new Date(input.opensAt) : null, closesAt: input.closesAt ? new Date(input.closesAt) : null };
    if (window.opensAt || window.closesAt) {
      const err = windowError(window, s.windowDays);
      if (err) throw new ApiError(400, err, windowCodeMessage(err));
    }
  } else {
    window = defaultWindow(input.startsOn, tz, s.windowDays) ?? window;
  }
  const values = {
    id, ownerId: hostId, brand, type: input.type, title: input.title, honorees: input.honorees,
    startsOn: input.startsOn ?? null, venueName: input.venueName || null, city: input.city || null,
    theme: input.theme ?? "noir", timeZone: tz, opensAt: window.opensAt, closesAt: window.closesAt,
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
  const [o] = await db.select().from(schema.occasions).where(eq(schema.occasions.id, id));
  return { occasion: o! };
}

export async function updateOccasion(o: OccasionRow, p: z.infer<typeof patchSchema>) {
  const access = await accessForOccasion(o);
  assertWritable(access);
  const set: Partial<typeof schema.occasions.$inferInsert> = {};
  const s = await getSettings();
  const windowTouched = p.opensAt !== undefined || p.closesAt !== undefined || (p.timeZone !== undefined && p.timeZone !== o.timeZone);
  if (windowTouched) {
    assertCanEditWindow(access);
    const now = new Date();
    let opensAt = p.opensAt !== undefined ? (p.opensAt ? new Date(p.opensAt) : null) : o.opensAt;
    const closesAt = p.closesAt !== undefined ? (p.closesAt ? new Date(p.closesAt) : null) : o.closesAt;
    if (!opensAt && !closesAt && access.state === "setup") {
      // Clearing the window is allowed before paying.
    } else {
      const err = windowError({ opensAt, closesAt }, s.windowDays, now);
      if (err) throw new ApiError(400, err, windowCodeMessage(err));
      // A paid gallery moved into the past simply opens now.
      if (access.state === "paid" && opensAt! < now) opensAt = now;
    }
    set.opensAt = opensAt;
    set.closesAt = closesAt;
    if (p.timeZone !== undefined) set.timeZone = p.timeZone;
    if (access.paid && closesAt) set.deleteAfter = addMonths(closesAt, s.retentionMonths);
  } else if (p.startsOn && !o.opensAt && !o.closesAt && access.state === "setup") {
    // First date for an event without a window: give it the default window.
    const w = defaultWindow(p.startsOn, o.timeZone, s.windowDays);
    if (w) Object.assign(set, w);
  }
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
      // The cover is the host's choice and is shown on the guest welcome page: the clean display copy, never the original.
      const key = m.kind === "photo" ? (m.keyDisplay ?? m.keyThumb) : null;
      if (!key) throw badRequest("This photo can't be used as the cover");
      set.coverKey = key;
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

/** Full Occasion payload for a member (with `access` and the package fields). */
export async function occasionPayload(o: OccasionRow, role: "owner" | "cohost", access?: Access) {
  const [days, extras, a, s] = await Promise.all([loadDays(o.id), occasionExtras([o.id]), access ?? accessForOccasion(o), getSettings()]);
  touchEnded(o, a);
  const ex = extras.get(o.id);
  return toOccasion(o, days, {
    coverUrl: await coverUrlFor(ex?.coverKey ?? null), mediaCount: ex?.mediaCount ?? 0, guestCount: ex?.guestCount ?? 0, role,
  }, a, s);
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
  const [extras, access] = await Promise.all([occasionExtras(rows.map((r) => r.occasion.id)), accessForOccasions(rows.map((r) => r.occasion))]);
  const list = await Promise.all(rows.map(async (r) => {
    const ex = extras.get(r.occasion.id);
    const a = access.get(r.occasion.id)!;
    touchEnded(r.occasion, a);
    return {
      row: r.occasion,
      summary: toSummary(r.occasion, {
        coverUrl: await coverUrlFor(ex?.coverKey ?? null), mediaCount: ex?.mediaCount ?? 0, guestCount: ex?.guestCount ?? 0, role: r.role as "owner" | "cohost",
      }, a),
    };
  }));
  // Newest event date first; undated by creation.
  list.sort((a, b) => (b.row.startsOn || b.row.createdAt.toISOString()).localeCompare(a.row.startsOn || a.row.createdAt.toISOString()));
  return list.map((l) => l.summary);
}

/** Deletes an event with every file it holds (media, guestbook recordings, custom cover). Used by the owner and by admins. */
export async function deleteOccasion(occasionId: string) {
  await deleteObjects(await keysForOccasion(occasionId));
  // Payment records survive the event in anonymised form (privacy policy: six years). Checkouts that were never paid
  // aren't payments and go; paid / refunded guest purchases lose the buyer's email and the download token, and the
  // delete below cuts their link to the event (and the orders' link) through ON DELETE SET NULL.
  const P = schema.guestPurchases;
  await db.batch([
    db.delete(P).where(and(eq(P.occasionId, occasionId), eq(P.status, "pending"))),
    db.update(P).set({ email: null, downloadTokenHash: null }).where(eq(P.occasionId, occasionId)),
    db.delete(schema.occasions).where(eq(schema.occasions.id, occasionId)),
  ]);
}

export async function keysForOccasion(occasionId: string) {
  const media = await db.select().from(schema.media).where(eq(schema.media.occasionId, occasionId));
  const msgs = await db.select({ k: schema.messages.mediaKey }).from(schema.messages).where(eq(schema.messages.occasionId, occasionId));
  // Custom covers live under o/{id}/cover/ and aren't media rows.
  const [occ] = await db.select({ k: schema.occasions.coverKey }).from(schema.occasions).where(eq(schema.occasions.id, occasionId));
  const cover = occ?.k?.startsWith(`o/${occasionId}/cover/`) ? occ.k : null;
  return [...media.flatMap(mediaFileKeys), ...msgs.map((m) => m.k), cover].filter((k): k is string => !!k);
}

