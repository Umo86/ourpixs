import { route, json, assertUuid } from "@/lib/http";
import { occasionBySlug, requireGuest } from "@/lib/guest";
import { limit } from "@/lib/rate-limit";
import { guestOriginalUrl } from "@/lib/guest-purchase";

/**
 * One original for a guest → `{ url }` (signed, 1 h). Their OWN uploads are always free; anyone else's needs an
 * active "download everything" purchase on this device (402 `purchase_required` otherwise).
 */
export const GET = route<{ slug: string; mediaId: string }>(async (_req, { slug, mediaId }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  assertUuid(mediaId, "photo");
  await limit(`gmd:${guest.id}`, 300, 600);
  return json({ url: await guestOriginalUrl(o, guest, mediaId) });
});
