import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApiError, assertUuid, json, notFound, readJson } from "@/lib/http";
import { adminRoute, audit, reasonSchema } from "@/lib/admin";
import { deleteOccasion } from "@/lib/occasion-service";
import { getSettings } from "@/lib/settings";
import { addMonths } from "@/lib/window";

export const maxDuration = 60;

const body = z.object({
  action: z.enum(["lock", "unlock", "archive", "unarchive", "mark_paid", "reset_setup", "clear_fair_use"]),
  reason: reasonSchema,
});

/**
 * lock / unlock: admin override that closes uploads and makes the event read-only (occasions.admin_locked_at, honoured by access.ts).
 * archive / unarchive: archived events disappear for guests (guest page, wall, share links) and stay visible to hosts.
 * mark_paid: complimentary package (no payment): setup → paid, comped_at set; delete_after from the window if there is one.
 * reset_setup: undo a complimentary package (back to setup). Refused when a payment exists: refund it in Stripe instead.
 * clear_fair_use: clears the fair-use flag (the alert can fire again if the event grows further).
 */
export const POST = adminRoute<{ id: string }>(async (req, { id }, admin) => {
  assertUuid(id, "event");
  const b = await readJson(req, body);
  const O = schema.occasions;
  const [o] = await db.select().from(O).where(eq(O.id, id)).limit(1);
  if (!o) throw notFound("Unknown event");
  // A deleted event kept only for guests' paid links can be locked (abuse) but never brought back.
  if (o.deletedAt && !["lock", "unlock"].includes(b.action)) throw new ApiError(409, "event_deleted", "This event has been deleted. Its files are only kept for guests' paid download links.");
  const now = new Date();
  let set: Partial<typeof O.$inferInsert>;
  let where = eq(O.id, id);
  switch (b.action) {
    case "lock": set = { adminLockedAt: o.adminLockedAt ?? now }; break;
    case "unlock": set = { adminLockedAt: null }; break;
    case "archive": set = { status: "archived" }; break;
    case "unarchive": set = { status: "active" }; break;
    case "clear_fair_use": set = { fairUseAlertedAt: null }; break;
    case "mark_paid": {
      if (o.packageStatus !== "setup") throw new ApiError(409, "not_setup", "Only an unpaid event can be marked as paid");
      const s = await getSettings();
      set = { packageStatus: "paid", paidAt: now, compedAt: now, deleteAfter: o.closesAt ? addMonths(o.closesAt, s.retentionMonths) : null };
      where = and(eq(O.id, id), eq(O.packageStatus, "setup"))!;
      break;
    }
    case "reset_setup": {
      if (!o.compedAt || !["paid", "live", "ended"].includes(o.packageStatus)) throw new ApiError(409, "not_comped", "Only an event marked as paid by an admin can go back to setup");
      const [paid] = await db.select({ id: schema.orders.id }).from(schema.orders)
        .where(and(eq(schema.orders.occasionId, id), eq(schema.orders.status, "paid"))).limit(1);
      if (paid) throw new ApiError(409, "has_payment", "This event has a payment. Refund it in Stripe instead.");
      // The unpaid-event deletion clock restarts now (setup_reset_at), with a fresh reminder before it.
      set = { packageStatus: "setup", paidAt: null, compedAt: null, deleteAfter: null, endedEmailSentAt: null, reminder30SentAt: null, reminder7SentAt: null, setupResetAt: now, unpaidReminderSentAt: null };
      break;
    }
  }
  await db.update(O).set(set).where(where);
  await audit(admin, `occasion.${b.action}`, "occasion", id, {
    title: o.title, slug: o.slug, previousStatus: o.status, previousPackage: o.packageStatus, reason: b.reason,
  });
  return json({ ok: true });
});

const del = z.object({ confirmSlug: z.string().trim().max(80), reason: reasonSchema });

/**
 * Deletes the event and every file it holds (the same deletion the owner uses). Type the event's link code to confirm.
 * If guests still have paid download links, the event is hidden and closed now and its photo/video files are kept until
 * the last link expires (occasion-service.ts → deleteOccasion); the response says until when.
 */
export const DELETE = adminRoute<{ id: string }>(async (req, { id }, admin) => {
  assertUuid(id, "event");
  const b = await readJson(req, del);
  const O = schema.occasions;
  const [o] = await db.select({ id: O.id, title: O.title, slug: O.slug, ownerId: O.ownerId }).from(O).where(eq(O.id, id)).limit(1);
  if (!o) throw notFound("Unknown event");
  if (b.confirmSlug !== o.slug) throw new ApiError(400, "confirm_mismatch", "The link code doesn't match");
  const r = await deleteOccasion(o.id, "admin");
  await audit(admin, "occasion.delete", "occasion", id, {
    title: o.title, slug: o.slug, ownerId: o.ownerId, reason: b.reason, filesKeptUntil: r.keptUntil?.toISOString() ?? null, guestPurchases: r.purchases,
  });
  return json({ ok: true, filesKeptUntil: r.keptUntil?.toISOString() ?? null });
});
