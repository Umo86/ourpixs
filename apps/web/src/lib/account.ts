import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteOccasion } from "./occasion-service";

/**
 * Real account deletion (App Store / Play requirement): every event the host owns is deleted with all files;
 * co-host memberships and push tokens go too. Event packages are one-off payments, so there is nothing to cancel.
 */
export async function deleteAccount(hostId: string) {
  const [host] = await db.select().from(schema.hosts).where(eq(schema.hosts.id, hostId)).limit(1);
  if (!host) return;

  const events = await db.select({ id: schema.occasions.id }).from(schema.occasions).where(eq(schema.occasions.ownerId, hostId));
  for (const o of events) await deleteOccasion(o.id);
  // Payment rows keep no personal link once the host is gone (Stripe keeps the receipts).
  await db.delete(schema.orders).where(eq(schema.orders.hostId, hostId));
  await db.delete(schema.loginTokens).where(eq(schema.loginTokens.email, host.email));
  await db.delete(schema.hosts).where(eq(schema.hosts.id, hostId));
}
