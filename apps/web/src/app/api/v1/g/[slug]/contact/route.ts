import { z } from "zod";
import { after } from "next/server";
import { route, json, readJson, clientIp } from "@/lib/http";
import { occasionBySlug, requireGuest, requirePinAccess } from "@/lib/guest";
import { limit } from "@/lib/rate-limit";
import { accessForOccasion, assertGuestsCanView } from "@/lib/access";
import { requestBrand } from "@/lib/request";
import { consentWording, recordConsent, recordGuestContact, sendGuestGalleryEmails } from "@/lib/consent";

/**
 * A guest asks for the event's photos by email (optional; never needed to upload). `marketing` is a SEPARATE, unticked
 * opt-in: when true we record a marketing consent with the exact wording the guest saw (rendered here from the same
 * message key and the locale the card was shown in). The email alone always works.
 */
const body = z.object({
  email: z.email().max(200),
  marketing: z.boolean().optional().default(false),
  locale: z.enum(["en", "tr"]),
});

export const POST = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const ip = clientIp(req);
  const guest = await requireGuest(o);
  await requirePinAccess(o, ip, guest);
  const access = await accessForOccasion(o);
  assertGuestsCanView(access);
  await limit(`contact:${o.id}:${guest.id}`, 5, 3600);
  await limit(`contact:ip:${ip}`, 30, 3600);
  const b = await readJson(req, body);
  const brand = requestBrand(req);
  await recordGuestContact({ occasionId: o.id, guestId: guest.id, email: b.email, locale: b.locale, brand });
  if (b.marketing) {
    await recordConsent({
      email: b.email, brand, locale: b.locale, source: "guest_upload", wording: consentWording(b.locale, brand, "guest_upload"),
      occasionId: o.id, ip, userAgent: req.headers.get("user-agent"),
    });
  }
  // Asked after the gallery already closed: send it now rather than waiting for the daily job.
  if (access.state === "ended") after(() => sendGuestGalleryEmails({ occasionIds: [o.id] }).then(() => undefined).catch((e) => console.error("[contact] gallery email", e)));
  return json({ ok: true });
});
