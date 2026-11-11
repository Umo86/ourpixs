import "server-only";
import { cookies, headers } from "next/headers";
import { and, eq, ne, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { hmac, randomToken, requireEnv, safeEqual, sha256, verifySecret } from "./crypto";
import { ApiError, notFound } from "./http";
import { ensureTokens, consume } from "./rate-limit";
import { isSlug } from "./slug";

type OccasionRow = typeof schema.occasions.$inferSelect;
export type GuestRow = typeof schema.guests.$inferSelect;

export const guestCookieName = (slug: string) => `op_g_${slug}`;
export const pinCookieName = (slug: string) => `op_p_${slug}`;
const YEAR = 365 * 24 * 3600;

const secret = () => requireEnv("GUEST_TOKEN_SECRET", 16);

/** New device token. The client keeps `<raw>.<hmac>`; the DB keeps only sha256(raw). */
export function mintGuestToken() {
  const raw = randomToken(24);
  return { token: `${raw}.${hmac(secret(), `g:${raw}`)}`, hash: sha256(raw) };
}

function rawFromSigned(signed: string | null | undefined): string | null {
  if (!signed) return null;
  const [raw, sig] = signed.split(".");
  if (!raw || !sig) return null;
  return safeEqual(sig, hmac(secret(), `g:${raw}`)) ? raw : null;
}

export function guestCookie(slug: string, token: string) {
  return { name: guestCookieName(slug), value: token, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: YEAR };
}

/** PIN proof cookie: bound to the current PIN hash, so changing the PIN logs everyone out. */
export function pinProof(o: OccasionRow) {
  return hmac(secret(), `pin:${o.id}:${o.pinHash ?? ""}`);
}
export function pinCookie(o: OccasionRow) {
  return { name: pinCookieName(o.slug), value: pinProof(o), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 30 * 24 * 3600 };
}

/** Active (non-archived) occasion by random slug or vanity name, or 404. Cookies always use the random `slug`. */
export async function occasionBySlug(slug: string): Promise<OccasionRow> {
  if (!isSlug(slug)) throw notFound("Unknown event");
  const [o] = await db.select().from(schema.occasions)
    .where(and(or(eq(schema.occasions.slug, slug), eq(schema.occasions.vanitySlug, slug.toLowerCase())), ne(schema.occasions.status, "archived"))).limit(1);
  if (!o) throw notFound("Unknown event");
  return o;
}

async function readGuestToken(slug: string): Promise<string | null> {
  const h = await headers();
  return h.get("x-guest-token") || (await cookies()).get(guestCookieName(slug))?.value || null;
}

export async function currentGuestToken(slug: string) {
  const signed = await readGuestToken(slug);
  return rawFromSigned(signed) ? signed : null;
}

export async function getGuest(o: OccasionRow): Promise<GuestRow | null> {
  const raw = rawFromSigned(await readGuestToken(o.slug));
  if (!raw) return null;
  const [g] = await db.select().from(schema.guests)
    .where(and(eq(schema.guests.occasionId, o.id), eq(schema.guests.deviceTokenHash, sha256(raw)))).limit(1);
  return g ?? null;
}

export async function requireGuest(o: OccasionRow): Promise<GuestRow> {
  const g = await getGuest(o);
  if (!g) throw new ApiError(401, "not_joined", "Join the event first");
  if (g.blockedAt) throw new ApiError(403, "guest_blocked", "The hosts have turned off uploads from this device");
  return g;
}

/**
 * Checks a typed PIN with brute-force protection (10 wrong tries / 10 min per IP+event).
 * Returns true/false; throws 429 when locked out.
 */
export async function checkPin(o: OccasionRow, pin: string, ip: string): Promise<boolean> {
  if (!o.pinHash) return true;
  const key = `pin:${o.id}:${ip}`;
  await ensureTokens(key, 10, 600);
  const ok = await verifySecret(pin.trim(), o.pinHash);
  if (!ok) await consume(key, 10, 600);
  return ok;
}

/** PIN satisfied by: no PIN set, a joined guest, the proof cookie, or a correct X-Occasion-Pin header. */
export async function hasPinAccess(o: OccasionRow, ip: string, guest?: GuestRow | null): Promise<boolean> {
  if (!o.pinHash) return true;
  if (guest) return true;
  const c = (await cookies()).get(pinCookieName(o.slug))?.value;
  if (c && safeEqual(c, pinProof(o))) return true;
  const header = (await headers()).get("x-occasion-pin");
  if (header) return checkPin(o, header, ip);
  return false;
}

export async function requirePinAccess(o: OccasionRow, ip: string, guest?: GuestRow | null) {
  if (!(await hasPinAccess(o, ip, guest))) throw new ApiError(401, "pin_required", "This event is protected with a PIN");
}
