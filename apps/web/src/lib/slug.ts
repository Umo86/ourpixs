import "server-only";
import { randomBytes } from "node:crypto";

// No 0/O/1/l/I to keep slugs readable when typed from a printed card.
const ALPHABET = "23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

/** Unguessable random id from a 57-char alphabet (10 chars ≈ 58 bits). Rejection sampling avoids modulo bias. */
export function randomSlug(length = 10): string {
  const max = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < max) out += ALPHABET[b % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Random slugs or vanity names. */
export function isSlug(s: string): boolean {
  return /^[0-9a-zA-Z-]{3,40}$/.test(s);
}

const RESERVED = new Set([
  "admin", "api", "app", "apps", "dashboard", "login", "logout", "wall", "www", "help", "support", "g", "s", "d", "new",
  "settings", "ourpixs", "bizimresimler", "static", "null", "undefined", "test", "privacy", "terms", "pricing", "features",
  "partners", "credits", "about", "contact", "blog", "mail", "root", "system", "official", "billing", "account", "demo",
]);

/** Vanity link names: lowercase a–z, 0–9 and single hyphens, 3–40 chars, not reserved. Returns null if valid, else an error code. */
export function vanityError(v: string): "invalid" | "reserved" | null {
  if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$/.test(v)) return "invalid";
  if (RESERVED.has(v)) return "reserved";
  return null;
}
