import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, notFound, assertUuid } from "@/lib/http";
import { requireMember } from "@/lib/auth";

/** Block a guest: hide all their media and stop that device from uploading again. */
export const POST = route<{ id: string; guestId: string }>(async (_req, { id, guestId }) => {
  const { occasion } = await requireMember(id);
  assertUuid(guestId, "guest");
  const [g] = await db.update(schema.guests).set({ blockedAt: new Date() })
    .where(and(eq(schema.guests.id, guestId), eq(schema.guests.occasionId, occasion.id))).returning({ id: schema.guests.id });
  if (!g) throw notFound("Unknown guest");
  await db.update(schema.media).set({ visibility: "hidden" })
    .where(and(eq(schema.media.guestId, guestId), eq(schema.media.occasionId, occasion.id), ne(schema.media.visibility, "deleted")));
  return json({ ok: true });
});

/** Unblock (media stays hidden; the host can show items again from the album). */
export const DELETE = route<{ id: string; guestId: string }>(async (_req, { id, guestId }) => {
  const { occasion } = await requireMember(id);
  assertUuid(guestId, "guest");
  await db.update(schema.guests).set({ blockedAt: null }).where(and(eq(schema.guests.id, guestId), eq(schema.guests.occasionId, occasion.id)));
  return json({ ok: true });
});
