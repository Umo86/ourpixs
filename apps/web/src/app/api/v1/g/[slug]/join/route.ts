import { z } from "zod";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, clientIp, ApiError } from "@/lib/http";
import { checkPin, currentGuestToken, getGuest, guestCookie, mintGuestToken, occasionBySlug, pinCookie } from "@/lib/guest";
import { limit } from "@/lib/rate-limit";

const body = z.object({
  name: z.string().trim().min(1).max(40),
  consent: z.literal(true),
  pin: z.string().trim().max(12).optional(),
  /** Additive: a view_upload share-link token lets family abroad join without the PIN. */
  shareToken: z.string().max(64).optional(),
});

export const POST = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const ip = clientIp(req);
  const b = await readJson(req, body);
  const existing = await getGuest(o);
  if (existing?.blockedAt) throw new ApiError(403, "guest_blocked", "The hosts have turned off uploads from this device");

  if (o.pinHash && !existing) {
    let viaShare = false;
    if (b.shareToken) {
      const [link] = await db.select().from(schema.shareLinks).where(and(
        eq(schema.shareLinks.token, b.shareToken), eq(schema.shareLinks.occasionId, o.id), eq(schema.shareLinks.scope, "view_upload"),
        or(isNull(schema.shareLinks.expiresAt), gt(schema.shareLinks.expiresAt, new Date())),
      )).limit(1);
      viaShare = !!link;
    }
    if (!viaShare) {
      if (!b.pin) throw new ApiError(401, "pin_required", "This event is protected with a PIN");
      if (!(await checkPin(o, b.pin, ip))) throw new ApiError(401, "pin_invalid", "That PIN is not right");
    }
  }

  let guest = existing;
  let token = existing ? await currentGuestToken(o.slug) : null;
  if (guest && token) {
    if (guest.displayName !== b.name) {
      [guest] = await db.update(schema.guests).set({ displayName: b.name }).where(eq(schema.guests.id, guest.id)).returning();
    }
  } else {
    await limit(`join:${o.id}:${ip}`, 30, 3600);
    const minted = mintGuestToken();
    [guest] = await db.insert(schema.guests).values({
      occasionId: o.id, displayName: b.name, deviceTokenHash: minted.hash, consentedAt: new Date(),
    }).returning();
    token = minted.token;
  }
  const res = json({ guestToken: token!, guest: { id: guest!.id, displayName: guest!.displayName } });
  res.cookies.set(guestCookie(o.slug, token!));
  if (o.pinHash) res.cookies.set(pinCookie(o));
  return res;
});
