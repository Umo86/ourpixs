import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteOccasion } from "./occasion-service";
import { withdrawConsent } from "./consent";

/**
 * Real account deletion (App Store / Play requirement): every event the host owns is deleted with all files;
 * co-host memberships and push tokens go too. Event packages are one-off payments, so there is nothing to cancel.
 */
export async function deleteAccount(hostId: string) {
  const [host] = await db.select().from(schema.hosts).where(eq(schema.hosts.id, hostId)).limit(1);
  if (!host) return;

  const events = await db.select({ id: schema.occasions.id }).from(schema.occasions).where(eq(schema.occasions.ownerId, hostId));
  for (const o of events) await deleteOccasion(o.id);
  // Payment records are kept for six years (privacy policy; UK tax rules) in anonymised form: deleting the events and
  // the host below cuts the links (orders.occasion_id / host_id and guest_purchases.occasion_id are ON DELETE SET NULL,
  // migration 0010), leaving the amount, dates, kind, livemode and Stripe ids. Never delete `orders` rows here.
  await db.delete(schema.loginTokens).where(eq(schema.loginTokens.email, host.email));
  // Marketing consent ends with the account (the consent record itself is kept for 2 years as proof, then purged).
  await withdrawConsent(host.email, "all", "account_deleted");
  await db.delete(schema.hosts).where(eq(schema.hosts.id, hostId));
}
