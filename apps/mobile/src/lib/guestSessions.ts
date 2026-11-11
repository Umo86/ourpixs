import { storage } from "./storage";

/** A guest identity for one event, stored per slug. The token is sent as X-Guest-Token. */
export type GuestSession = { slug: string; token: string; guestId: string; name: string; pin?: string; title?: string; joinedAt: string };

const INDEX_KEY = "op_guest_index";
const key = (slug: string) => `op_guest_${slug}`;

export async function getGuestSession(slug: string): Promise<GuestSession | null> {
  return storage.getJSON<GuestSession>(key(slug));
}

export async function saveGuestSession(s: GuestSession): Promise<void> {
  await storage.setJSON(key(s.slug), s);
  const idx = (await storage.getJSON<string[]>(INDEX_KEY)) ?? [];
  if (!idx.includes(s.slug)) await storage.setJSON(INDEX_KEY, [s.slug, ...idx].slice(0, 50));
}

export async function removeGuestSession(slug: string): Promise<void> {
  await storage.remove(key(slug));
  const idx = (await storage.getJSON<string[]>(INDEX_KEY)) ?? [];
  await storage.setJSON(INDEX_KEY, idx.filter((s) => s !== slug));
}

export async function listGuestSessions(): Promise<GuestSession[]> {
  const idx = (await storage.getJSON<string[]>(INDEX_KEY)) ?? [];
  const all = await Promise.all(idx.map((s) => getGuestSession(s)));
  return all.filter((s): s is GuestSession => !!s);
}

/** Remembered PIN for an event (entered before joining). */
export async function getPin(slug: string): Promise<string | null> {
  return storage.get(`op_pin_${slug}`);
}
export async function savePin(slug: string, pin: string): Promise<void> {
  await storage.set(`op_pin_${slug}`, pin);
}

/**
 * Extracts an event slug from a scanned QR / pasted text.
 * Accepts https://ourpixs.com/g/<slug>, https://bizimresimler.com/g/<slug>?x=y, ourpixs://g/<slug>, or a bare code.
 */
export function parseEventCode(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/\/g\/([A-Za-z0-9_-]{3,64})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{3,64}$/.test(s)) return s;
  return null;
}
