import { route, json, clientIp } from "@/lib/http";
import { getGuest, occasionBySlug, requirePinAccess } from "@/lib/guest";
import { loadDays } from "@/lib/queries";
import { coverUrlFor, toPublicOccasion } from "@/lib/serializers";
import { requestLocale } from "@/lib/request";
import { accessForOccasion } from "@/lib/access";
import { getSettings } from "@/lib/settings";

export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await getGuest(o);
  await requirePinAccess(o, clientIp(req), guest);
  const [days, cover, access, s] = await Promise.all([loadDays(o.id), coverUrlFor(o.coverKey), accessForOccasion(o), getSettings()]);
  // Always answers (also before the gallery opens): `galleryState` and `opensAt` drive the "opens on …" page.
  const occasion = toPublicOccasion(o, days, requestLocale(req), cover, access, s.videoMaxSeconds);
  // `guest` is additive: who this device is joined as (null if not joined yet).
  return json({ occasion, guest: guest ? { id: guest.id, displayName: guest.displayName, shotsTaken: guest.shotsTaken } : null, uploadsOpen: occasion.uploadsOpen });
});
