import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApiError } from "./http";
import { keysForOccasion } from "./occasion-service";
import { deleteObjects } from "./storage";

/**
 * Real account deletion (App Store / Play requirement):
 *  - blocked while the host owns a partner account that isn't cancelled (transfer or cancel first)
 *  - cancelled partner accounts they own are deleted (their events stay, unlinked)
 *  - partner events they created are handed to the partner's owner instead of being deleted
 *  - every other event they own is deleted with all files; co-host memberships and push tokens go too
 */
export async function deleteAccount(hostId: string) {
  const owned = await db.select({ org: schema.organisations }).from(schema.organisationMembers)
    .innerJoin(schema.organisations, eq(schema.organisations.id, schema.organisationMembers.organisationId))
    .where(and(eq(schema.organisationMembers.hostId, hostId), eq(schema.organisationMembers.role, "owner")));
  const activeOrg = owned.find((o) => o.org.status !== "cancelled");
  if (activeOrg) {
    throw new ApiError(409, "org_owner", `You own the partner account "${activeOrg.org.name}". Cancel its subscription or transfer ownership first.`);
  }

  const events = await db.select().from(schema.occasions).where(eq(schema.occasions.ownerId, hostId));
  for (const o of events) {
    if (o.organisationId && !owned.some((x) => x.org.id === o.organisationId)) {
      const [orgOwner] = await db.select({ hostId: schema.organisationMembers.hostId }).from(schema.organisationMembers)
        .where(and(eq(schema.organisationMembers.organisationId, o.organisationId), eq(schema.organisationMembers.role, "owner"), ne(schema.organisationMembers.hostId, hostId))).limit(1);
      if (orgOwner) {
        await db.update(schema.occasions).set({ ownerId: orgOwner.hostId }).where(eq(schema.occasions.id, o.id));
        await db.insert(schema.occasionMembers).values({ occasionId: o.id, hostId: orgOwner.hostId, role: "owner" })
          .onConflictDoUpdate({ target: [schema.occasionMembers.occasionId, schema.occasionMembers.hostId], set: { role: "owner" } });
        continue;
      }
    }
    await deleteObjects(await keysForOccasion(o.id));
    await db.delete(schema.occasions).where(eq(schema.occasions.id, o.id));
  }
  if (owned.length) {
    const ids = owned.map((o) => o.org.id);
    const logos = owned.map((o) => o.org.logoKey);
    await deleteObjects(logos).catch(() => {});
    await db.delete(schema.organisations).where(inArray(schema.organisations.id, ids));
  }
  // Orders for events the host didn't own keep no personal link once the host is gone.
  await db.delete(schema.orders).where(eq(schema.orders.hostId, hostId));
  const [host] = await db.select({ email: schema.hosts.email }).from(schema.hosts).where(eq(schema.hosts.id, hostId)).limit(1);
  if (host) await db.delete(schema.loginTokens).where(eq(schema.loginTokens.email, host.email));
  await db.delete(schema.hosts).where(eq(schema.hosts.id, hostId));
}
