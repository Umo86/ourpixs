import "server-only";
import { and, eq, ne, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteObjects, mediaFileKeys } from "./storage";

const { media } = schema;

export type MediaAction = "hide" | "show" | "delete" | "favourite" | "unfavourite" | "approve";

/**
 * Applies a moderation action to every media row matching `scope` (always scope by event or ids).
 * Used by the host album API and by admins. Delete removes the files too; if storage fails the rows stay
 * marked "deleted" (never served) and the cleanup cron retries.
 */
export async function applyMediaAction(scope: SQL, action: MediaAction) {
  if (action === "delete") {
    const rows = await db.select().from(media).where(scope);
    // Hide first so nothing is served while storage deletes; the cleanup cron retries if storage fails.
    await db.update(media).set({ visibility: "deleted" }).where(scope);
    try {
      await deleteObjects(rows.flatMap(mediaFileKeys));
      await db.delete(media).where(scope);
    } catch (e) {
      console.error("[media] storage delete failed; cron will retry", e);
    }
    return;
  }
  const set =
    action === "hide" ? { visibility: "hidden" as const }
    : action === "show" ? { visibility: "visible" as const }
    : action === "favourite" ? { favourite: true }
    : action === "unfavourite" ? { favourite: false }
    : { approved: true };
  await db.update(media).set(set).where(and(scope, ne(media.visibility, "deleted")));
}

/**
 * Block: hides all the guest's media in that event and stops that device from uploading or joining again.
 * Unblock: the device can upload again; their media stays hidden (it can be shown again item by item).
 * Returns false when the guest isn't part of the event.
 */
export async function setGuestBlocked(occasionId: string, guestId: string, blocked: boolean): Promise<boolean> {
  const [g] = await db.update(schema.guests).set({ blockedAt: blocked ? new Date() : null })
    .where(and(eq(schema.guests.id, guestId), eq(schema.guests.occasionId, occasionId))).returning({ id: schema.guests.id });
  if (!g) return false;
  if (blocked) {
    await db.update(media).set({ visibility: "hidden" })
      .where(and(eq(media.guestId, guestId), eq(media.occasionId, occasionId), ne(media.visibility, "deleted")));
  }
  return true;
}
