import { route, json, clientIp } from "@/lib/http";
import { getGuest, occasionBySlug, requirePinAccess } from "@/lib/guest";
import { loadDays } from "@/lib/queries";
import { coverUrlFor, toPublicOccasion } from "@/lib/serializers";
import { requestLocale } from "@/lib/request";
import { accessForOccasion } from "@/lib/access";

export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await getGuest(o);
  await requirePinAccess(o, clientIp(req), guest);
  const occasion = toPublicOccasion(o, await loadDays(o.id), requestLocale(req), await coverUrlFor(o.coverKey), await accessForOccasion(o));
  // `guest` is additive: who this device is joined as (null if not joined yet).
  return json({ occasion, guest: guest ? { id: guest.id, displayName: guest.displayName, shotsTaken: guest.shotsTaken } : null, uploadsOpen: occasion.uploadsOpen });
});
