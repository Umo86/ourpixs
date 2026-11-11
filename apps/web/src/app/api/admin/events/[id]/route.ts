import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApiError, assertUuid, json, notFound, readJson } from "@/lib/http";
import { adminRoute, audit, reasonSchema } from "@/lib/admin";
import { deleteOccasion } from "@/lib/occasion-service";

export const maxDuration = 60;

const body = z.object({ action: z.enum(["lock", "unlock", "archive", "unarchive"]), reason: reasonSchema });

/**
 * lock / unlock: admin override that closes guest uploads and makes the event read-only (occasions.admin_locked_at, honoured by access.ts).
 * archive / unarchive: archived events disappear for guests (guest page, wall, share links) and stay visible to hosts.
 */
export const POST = adminRoute<{ id: string }>(async (req, { id }, admin) => {
  assertUuid(id, "event");
  const b = await readJson(req, body);
  const O = schema.occasions;
  const [o] = await db.select({ id: O.id, title: O.title, slug: O.slug, status: O.status, adminLockedAt: O.adminLockedAt }).from(O).where(eq(O.id, id)).limit(1);
  if (!o) throw notFound("Unknown event");
  const set =
    b.action === "lock" ? { adminLockedAt: o.adminLockedAt ?? new Date() }
    : b.action === "unlock" ? { adminLockedAt: null }
    : b.action === "archive" ? { status: "archived" as const }
    : { status: "active" as const };
  await db.update(O).set(set).where(eq(O.id, id));
  await audit(admin, `occasion.${b.action}`, "occasion", id, { title: o.title, slug: o.slug, previousStatus: o.status, reason: b.reason });
  return json({ ok: true });
});

const del = z.object({ confirmSlug: z.string().trim().max(80), reason: reasonSchema });

/** Deletes the event and every file it holds (the same deletion the owner uses). Type the event's link code to confirm. */
export const DELETE = adminRoute<{ id: string }>(async (req, { id }, admin) => {
  assertUuid(id, "event");
  const b = await readJson(req, del);
  const O = schema.occasions;
  const [o] = await db.select({ id: O.id, title: O.title, slug: O.slug, ownerId: O.ownerId }).from(O).where(eq(O.id, id)).limit(1);
  if (!o) throw notFound("Unknown event");
  if (b.confirmSlug !== o.slug) throw new ApiError(400, "confirm_mismatch", "The link code doesn't match");
  await deleteOccasion(o.id);
  await audit(admin, "occasion.delete", "occasion", id, { title: o.title, slug: o.slug, ownerId: o.ownerId, reason: b.reason });
  return json({ ok: true });
});
