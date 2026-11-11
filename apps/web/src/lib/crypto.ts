import "server-only";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual, randomInt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmac(secret: string, input: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += String(randomInt(0, 10));
  return s;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** scrypt hash for short secrets like event PINs: `s1$<salt>$<hash>`. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(secret, salt, 32);
  return `s1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [v, saltB64, hashB64] = stored.split("$");
  if (v !== "s1" || !saltB64 || !hashB64) return false;
  const key = await scryptAsync(secret, Buffer.from(saltB64, "base64url"), 32);
  return safeEqual(key.toString("base64url"), hashB64);
}

export function requireEnv(name: string, minLength = 1): string {
  const v = process.env[name];
  if (!v || v.length < minLength) throw new Error(`${name} is not set`);
  return v;
}
