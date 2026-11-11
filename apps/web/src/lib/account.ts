import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cancelSubscriptionNow } from "./billing";
import { ApiError } from "./http";
import { deleteOccasion } from "./occasion-service";

/**
 * Real account deletion (App Store / Play requirement):
 *  - the Stripe subscription (if any) is cancelled immediately, before anything is deleted
 *  - every event the host owns is deleted with all files; co-host memberships and push tokens go too
 */
export async function deleteAccount(hostId: string) {
  const [host] = await db.select().from(schema.hosts).where(eq(schema.hosts.id, hostId)).limit(1);
  if (!host) return;
  try {
    await cancelSubscriptionNow(host.stripeSubscriptionId);
  } catch (e) {
    // Never delete the account while it might still be billed.
    console.error("[account] stripe cancel failed", e);
    throw new ApiError(502, "billing_error", "We couldn't cancel your subscription. Please try again or contact support.");
  }

  const events = await db.select({ id: schema.occasions.id }).from(schema.occasions).where(eq(schema.occasions.ownerId, hostId));
  for (const o of events) await deleteOccasion(o.id);
  // Legacy one-off orders keep no personal link once the host is gone.
  await db.delete(schema.orders).where(eq(schema.orders.hostId, hostId));
  await db.delete(schema.loginTokens).where(eq(schema.loginTokens.email, host.email));
  await db.delete(schema.hosts).where(eq(schema.hosts.id, hostId));
}
