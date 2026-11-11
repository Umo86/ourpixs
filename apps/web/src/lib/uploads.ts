import "server-only";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ALLOWED_MIME } from "./config";
import { ApiError, badRequest, planFeature, planLimit } from "./http";
import { activeDays, canonicalMoment, dayUploadOpen, planOf, uploadOpen } from "./occasion";
import { nsfwCheck, signalFlags } from "./moderation";
import { assertOrgWritable } from "./org";
import { notifyHosts } from "./push";
import { after } from "next/server";
import { loadDays, mediaCountForLimit } from "./queries";
import { limit } from "./rate-limit";
import { deleteObjects, finalizeUpload, headObject, mediaKeys, presignPut, storageDriver, StorageNotConfigured, type PresignedPut } from "./storage";

type OccasionRow = typeof schema.occasions.$inferSelect;
type GuestRow = typeof schema.guests.$inferSelect;
export type Actor = { guest: GuestRow } | { hostId: string };

const MAX_PHOTO_BYTES = 60 * 1024 * 1024;

export const uploadFileSchema = z.object({
  clientId: z.string().min(1).max(100),
  name: z.string().max(300).default(""),
  mime: z.string().max(100),
  bytes: z.number().int().positive(),
  kind: z.enum(["photo", "video", "voice"]),
  width: z.number().int().positive().max(20000).optional().nullable(),
  height: z.number().int().positive().max(20000).optional().nullable(),
  durationS: z.number().nonnegative().max(36000).optional().nullable(),
  dayId: z.string().uuid().optional().nullable(),
  momentTag: z.string().max(80).optional().nullable(),
  missionId: z.string().uuid().optional().nullable(),
  fromDisposable: z.boolean().optional(),
  hasDisplay: z.boolean().default(false),
  hasThumb: z.boolean().default(false),
  /** Additive: 64-bit dHash of the thumbnail as 16 hex chars. */
  phash: z.string().regex(/^[0-9a-f]{16}$/).optional().nullable(),
  /** Additive: variance of Laplacian (higher = sharper). */
  blurScore: z.number().min(0).max(1e7).optional().nullable(),
});
export const uploadsBodySchema = z.object({ files: z.array(uploadFileSchema).min(1).max(50) });
export const completeBodySchema = z.object({ mediaIds: z.array(z.string().uuid()).min(1).max(50) });

type UploadFile = z.infer<typeof uploadFileSchema>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function createUploads(o: OccasionRow, files: UploadFile[], actor: Actor) {
  if (!storageDriver()) throw new StorageNotConfigured();
  const plan = planOf(o);
  const guest = "guest" in actor ? actor.guest : null;
  if (o.status !== "active") throw new ApiError(403, "upload_closed", "This event is no longer accepting uploads");
  if (guest && !uploadOpen(o)) throw new ApiError(403, "upload_closed", "Uploads are closed for this event");
  if (o.storageExpiresAt && Date.now() >= o.storageExpiresAt.getTime()) throw new ApiError(403, "upload_closed", "This album has expired");
  await assertOrgWritable(o);

  await limit(guest ? `up:g:${guest.id}` : `up:h:${(actor as { hostId: string }).hostId}`, 400, 3600, files.length);

  for (const f of files) {
    if (!ALLOWED_MIME.includes(f.mime)) throw badRequest(`Unsupported file type: ${f.mime}`);
    const family = f.mime.split("/")[0];
    if ((f.kind === "photo" && family !== "image") || (f.kind === "video" && family !== "video") || (f.kind === "voice" && family !== "audio")) {
      throw badRequest("File kind does not match its type");
    }
    if (f.kind === "photo" && f.bytes > MAX_PHOTO_BYTES) throw planLimit("Photo is too large");
    if (f.kind === "video") {
      if (!plan.video) throw planFeature("video uploads");
      if (f.bytes > plan.maxVideoBytes) throw planLimit("Video is too large for this plan");
      if (f.durationS && f.durationS > plan.maxVideoSeconds + 1) throw planLimit("Video is too long for this plan");
    }
    if (f.kind === "voice" && !plan.voiceGuestbook) throw planFeature("voice messages");
  }

  if (plan.maxMedia !== null) {
    const used = await mediaCountForLimit(o.id);
    if (used + files.length > plan.maxMedia) throw planLimit(`This album is full (${plan.maxMedia} files on this plan)`);
  }

  const dayRows = activeDays(o, await loadDays(o.id));
  const dayIds = new Set(dayRows.map((d) => d.id));
  const openDays = guest ? dayRows.filter((d) => dayUploadOpen(d)) : dayRows;
  const defaultDay = openDays.find((d) => d.date === todayIso()) ?? openDays[0] ?? dayRows[0];
  if (guest) {
    for (const f of files) {
      const d = f.dayId ? dayRows.find((x) => x.id === f.dayId) : defaultDay;
      if (d && !dayUploadOpen(d)) throw new ApiError(403, "upload_closed", "Uploads are closed for this day");
    }
  }

  const missionIds = [...new Set(files.map((f) => f.missionId).filter((x): x is string => !!x))];
  if (missionIds.length) {
    if (!plan.missions) throw planFeature("photo missions");
    const found = await db.select({ id: schema.missions.id }).from(schema.missions)
      .where(and(eq(schema.missions.occasionId, o.id), inArray(schema.missions.id, missionIds)));
    if (found.length !== missionIds.length) throw badRequest("Unknown mission");
  }

  const disposableCount = guest ? files.filter((f) => f.fromDisposable).length : 0;
  if (disposableCount) {
    if (!plan.disposable || !o.disposableShots) throw planFeature("the disposable camera");
    const shots = o.disposableShots;
    const updated = await db.update(schema.guests)
      .set({ shotsTaken: sql`${schema.guests.shotsTaken} + ${disposableCount}` })
      .where(and(eq(schema.guests.id, guest!.id), sql`${schema.guests.shotsTaken} + ${disposableCount} <= ${shots}`))
      .returning({ id: schema.guests.id });
    if (!updated.length) throw new ApiError(409, "shots_exhausted", "No shots left on your disposable camera");
  }

  const prepared = files.map((f) => {
    const id = crypto.randomUUID();
    const keys = mediaKeys(o.id, id, f.mime);
    const hasDisplay = f.hasDisplay && f.kind !== "voice";
    const hasThumb = f.hasThumb && f.kind !== "voice";
    return {
      f, id,
      row: {
        id, occasionId: o.id,
        dayId: f.dayId && dayIds.has(f.dayId) ? f.dayId : (defaultDay?.id ?? null),
        guestId: guest?.id ?? null,
        uploadedByHostId: guest ? null : (actor as { hostId: string }).hostId,
        missionId: f.missionId ?? null,
        kind: f.kind, keyOriginal: keys.original,
        keyDisplay: hasDisplay ? keys.display : null, keyThumb: hasThumb ? keys.thumb : null,
        mime: f.mime, bytes: f.bytes, width: f.width ?? null, height: f.height ?? null,
        durationS: f.durationS != null ? Math.round(f.durationS) : null,
        momentTag: canonicalMoment(o, f.momentTag),
        fromDisposable: !!(guest && f.fromDisposable),
        status: "pending" as const,
        approved: guest ? !o.approvalMode : true,
        phash: f.phash ?? null,
        blurScore: f.blurScore ?? null,
      },
    };
  });

  await db.insert(schema.media).values(prepared.map((p) => p.row));

  const uploads = await Promise.all(prepared.map(async (p) => {
    const out: { clientId: string; mediaId: string; original: PresignedPut; display?: PresignedPut; thumb?: PresignedPut } = {
      clientId: p.f.clientId, mediaId: p.id, original: await presignPut(p.row.keyOriginal, p.f.mime, p.f.bytes),
    };
    if (p.row.keyDisplay) out.display = await presignPut(p.row.keyDisplay, "image/webp");
    if (p.row.keyThumb) out.thumb = await presignPut(p.row.keyThumb, "image/webp");
    return out;
  }));
  return uploads;
}

/** Marks uploads as done after confirming the objects exist in storage. Returns ids that never arrived. */
export async function completeUploads(o: OccasionRow, mediaIds: string[], actor: Actor) {
  const owner = "guest" in actor ? eq(schema.media.guestId, actor.guest.id) : eq(schema.media.uploadedByHostId, actor.hostId);
  const rows = await db.select().from(schema.media)
    .where(and(eq(schema.media.occasionId, o.id), inArray(schema.media.id, mediaIds), owner, eq(schema.media.status, "pending")));
  const plan = planOf(o);
  const missing: string[] = [];
  let pending = false;
  await Promise.all(rows.map(async (m) => {
    const orig = await finalizeUpload(m.keyOriginal);
    if (!orig) {
      missing.push(m.id);
      return;
    }
    const tooBig = m.kind === "video" ? orig.bytes > plan.maxVideoBytes : orig.bytes > MAX_PHOTO_BYTES;
    if (tooBig) {
      await deleteObjects([m.keyOriginal, m.keyDisplay, m.keyThumb]).catch(() => {});
      await db.update(schema.media).set({ status: "failed" }).where(eq(schema.media.id, m.id));
      missing.push(m.id);
      return;
    }
    const [disp, thumb] = await Promise.all([
      m.keyDisplay ? headObject(m.keyDisplay) : Promise.resolve(null),
      m.keyThumb ? headObject(m.keyThumb) : Promise.resolve(null),
    ]);
    const keyDisplay = disp ? m.keyDisplay : null;
    const keyThumb = thumb ? m.keyThumb : null;
    // Auto-moderation: flags only, never deletes. NSFW goes to the approval queue regardless of approval mode.
    const [flags, nsfw] = await Promise.all([signalFlags(m), nsfwCheck({ keyDisplay, keyThumb })]);
    if (nsfw) flags.push("nsfw");
    await db.update(schema.media).set({
      status: "uploaded", bytes: orig.bytes || m.bytes, keyDisplay, keyThumb,
      moderationFlags: flags, ...(nsfw ? { approved: false } : {}),
      createdAt: new Date(),
    }).where(eq(schema.media.id, m.id));
    if (nsfw || !m.approved) pending = true;
  }));
  // Push to hosts after the response is sent (guests' uploads only).
  if ("guest" in actor && rows.length > missing.length) {
    after(async () => {
      await notifyHosts(o, "first_upload");
      if (pending) await notifyHosts(o, "pending");
    });
  }
  return { missing };
}
