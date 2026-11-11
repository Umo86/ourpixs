import { route, json, notFound, assertUuid } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { setGuestBlocked } from "@/lib/media-actions";

/** Block a guest: hide all their media and stop that device from uploading again. */
export const POST = route<{ id: string; guestId: string }>(async (_req, { id, guestId }) => {
  const { occasion } = await requireMember(id);
  assertUuid(guestId, "guest");
  if (!(await setGuestBlocked(occasion.id, guestId, true))) throw notFound("Unknown guest");
  return json({ ok: true });
});

/** Unblock (media stays hidden; the host can show items again from the album). */
export const DELETE = route<{ id: string; guestId: string }>(async (_req, { id, guestId }) => {
  const { occasion } = await requireMember(id);
  assertUuid(guestId, "guest");
  await setGuestBlocked(occasion.id, guestId, false);
  return json({ ok: true });
});
