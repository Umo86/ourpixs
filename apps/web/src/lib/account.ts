import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteOccasion } from "./occasion-service";
import { withdrawConsent } from "./consent";

/**
 * Real account deletion (App Store / Play requirement): every event the host owns is deleted with all files;
 * co-host memberships and push tokens go too. Event packages are one-off payments, so there is nothing to cancel.
 *
 * Events whose guests still have paid "download everything" links keep their photo/video files (and their row) until
 * those links expire (occasion-service.ts → deleteOccasion). An event row needs its owner row (occasions.owner_id is
 * ON DELETE CASCADE), so in that case the account row is ANONYMISED instead of deleted: email replaced, name and Stripe
 * customer cleared, deleted_at set (it can't sign in; getSession ignores it). The cleanup cron removes it once its last
 * kept event is gone.
 */
export async function deleteAccount(hostId: string) {
  const [host] = await db.select().from(schema.hosts).where(eq(schema.hosts.id, hostId)).limit(1);
  if (!host) return;

  const events = await db.select({ id: schema.occasions.id }).from(schema.occasions).where(eq(schema.occasions.ownerId, hostId));
  let kept = 0;
  for (const o of events) {
    const r = await deleteOccasion(o.id, "account");
    if (r.keptUntil) kept++;
  }
  // Payment records are kept for six years (privacy policy; UK tax rules) in anonymised form: deleting the events and
  // the host below cuts the links (orders.occasion_id / host_id and guest_purchases.occasion_id are ON DELETE SET NULL,
  // migration 0010), leaving the amount, dates, kind, livemode and Stripe ids. Never delete `orders` rows here.
  await db.delete(schema.loginTokens).where(eq(schema.loginTokens.email, host.email));
  // Marketing consent ends with the account (the consent record itself is kept for 2 years as proof, then purged).
  await withdrawConsent(host.email, "all", "account_deleted");
  if (!kept) {
    await db.delete(schema.hosts).where(eq(schema.hosts.id, hostId));
    return;
  }
  await db.batch([
    db.delete(schema.occasionMembers).where(eq(schema.occasionMembers.hostId, hostId)),
    db.delete(schema.pushTokens).where(eq(schema.pushTokens.hostId, hostId)),
    db.update(schema.hosts).set({
      email: anonymisedEmail(hostId), name: null, stripeCustomerId: null, deletedAt: new Date(),
    }).where(eq(schema.hosts.id, hostId)),
  ]);
}

/** Unique, undeliverable placeholder for an anonymised account (RFC 2606 `.invalid`). */
export const anonymisedEmail = (hostId: string) => `deleted-${hostId}@deleted.invalid`;
