import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { sha256, randomDigits, safeEqual, requireEnv } from "./crypto";
import { ApiError, unauthorized, notFound, forbidden, isUuid } from "./http";
import { consume, limit } from "./rate-limit";
import { sendLoginCode, previewCodesAllowed, emailConfigured } from "./email";
import type { Brand, Locale } from "./config";

export const SESSION_COOKIE = "op_session";
const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type HostRow = typeof schema.hosts.$inferSelect;
export type OccasionRow = typeof schema.occasions.$inferSelect;
export type Role = "owner" | "cohost";

function secretKey() {
  return new TextEncoder().encode(requireEnv("AUTH_SECRET", 16));
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(email: string, code: string) {
  // Pepper with AUTH_SECRET so a DB leak alone can't brute-force the 6-digit space offline.
  return sha256(`${requireEnv("AUTH_SECRET", 16)}:${normalizeEmail(email)}:${code}`);
}

export async function signSession(hostId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(hostId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<string | null> {
  return (await verifySessionClaims(token))?.hostId ?? null;
}

/** Verified session claims: host id and when the token was issued (admin pages require a recent sign-in). */
export async function verifySessionClaims(token: string): Promise<{ hostId: string; issuedAt: Date | null } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || !isUuid(payload.sub)) return null;
    return { hostId: payload.sub, issuedAt: typeof payload.iat === "number" ? new Date(payload.iat * 1000) : null };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  };
}

/** Bearer header (mobile) wins over the cookie (web). */
async function readSessionToken(): Promise<string | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return (await cookies()).get(SESSION_COOKIE)?.value || null;
}

/**
 * The verified session (host row + token issue time), INCLUDING suspended hosts. Memoised per request.
 * Use getHost / requireHost for normal access: they treat a suspended account as signed out / rejected.
 */
export const getSession = cache(async (): Promise<{ host: HostRow; issuedAt: Date | null } | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  const claims = await verifySessionClaims(token);
  if (!claims) return null;
  const [host] = await db.select().from(schema.hosts).where(eq(schema.hosts.id, claims.hostId)).limit(1);
  // A deleted account kept anonymised for guests' paid links (src/lib/account.ts) is signed out everywhere.
  return host && !host.deletedAt ? { host, issuedAt: claims.issuedAt } : null;
});

/** Current (non-suspended) host or null. Memoised per request. Suspension applies immediately, even to existing sessions. */
export const getHost = cache(async (): Promise<HostRow | null> => {
  const s = await getSession();
  if (!s || s.host.suspendedAt) return null;
  return s.host;
});

export const accountSuspended = () => new ApiError(403, "account_suspended", "This account is suspended. Please contact support.");

export async function requireHost(): Promise<HostRow> {
  const s = await getSession();
  if (s?.host.suspendedAt) throw accountSuspended();
  if (!s) throw unauthorized();
  return s.host;
}

/** For server-component pages: redirect to /login instead of throwing (suspended accounts see a neutral notice there). */
export async function requireHostPage(next?: string): Promise<HostRow> {
  const s = await getSession();
  if (s?.host.suspendedAt) redirect("/login?suspended=1");
  if (!s) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return s.host;
}

/** Membership (owner or co-host) of an occasion. */
const loadMembership = cache(async (occasionId: string, hostId: string) => {
  const [row] = await db
    .select({ occasion: schema.occasions, role: schema.occasionMembers.role })
    .from(schema.occasionMembers)
    .innerJoin(schema.occasions, eq(schema.occasions.id, schema.occasionMembers.occasionId))
    .where(and(eq(schema.occasionMembers.occasionId, occasionId), eq(schema.occasionMembers.hostId, hostId), isNull(schema.occasions.deletedAt)))
    .limit(1);
  return row ?? null;
});

/** Host must be a member (owner or co-host) of the occasion. 404 (not 403) so ids can't be probed. */
export async function requireMember(occasionId: string, opts: { owner?: boolean } = {}) {
  const host = await requireHost();
  if (!isUuid(occasionId)) throw notFound("Unknown occasion");
  const m = await loadMembership(occasionId, host.id);
  if (!m) throw notFound("Unknown occasion");
  if (opts.owner && m.role !== "owner") throw forbidden("Only the owner can do this");
  return { host, occasion: m.occasion, role: m.role as Role };
}

/** Page variant: redirects to login / renders notFound. */
export async function requireMemberPage(occasionId: string) {
  const host = await requireHostPage(`/dashboard/${occasionId}`);
  if (!isUuid(occasionId)) return null;
  const m = await loadMembership(occasionId, host.id);
  if (!m) return null;
  return { host, occasion: m.occasion, role: m.role as Role };
}

export async function requestLoginCode(input: { email: string; locale: Locale; brand: Brand; ip: string }) {
  const email = normalizeEmail(input.email);
  await limit(`code:ip:${input.ip}`, 20, 900);
  await limit(`code:email:${email}`, 5, 900);
  // Review account: nothing to send, the reviewer types REVIEW_CODE.
  if (process.env.REVIEW_EMAIL && process.env.REVIEW_CODE && normalizeEmail(process.env.REVIEW_EMAIL) === email) return { ok: true as const };
  if (!emailConfigured() && !previewCodesAllowed()) {
    throw new ApiError(503, "email_unavailable", "Email sign-in is not configured yet");
  }
  const code = randomDigits(6);
  // Only the newest code is valid.
  await db.update(schema.loginTokens).set({ usedAt: new Date() })
    .where(and(eq(schema.loginTokens.email, email), isNull(schema.loginTokens.usedAt)));
  await db.insert(schema.loginTokens).values({ email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  if (emailConfigured()) {
    await sendLoginCode(email, code, input.locale, input.brand);
    return { ok: true as const };
  }
  return { ok: true as const, previewCode: code };
}

/** App-store review account: REVIEW_EMAIL + REVIEW_CODE (both must be set) sign in without an emailed code. */
function isReviewLogin(email: string, code: string): boolean {
  const re = process.env.REVIEW_EMAIL;
  const rc = process.env.REVIEW_CODE;
  if (!re || !rc) return false;
  return normalizeEmail(re) === email && safeEqual(code.trim(), rc.trim());
}

export async function verifyLoginCode(input: { email: string; code: string; locale: Locale; brand: Brand; ip: string }) {
  const email = normalizeEmail(input.email);
  await limit(`verify:ip:${input.ip}`, 30, 900);
  const attempt = await consume(`verify:email:${email}`, MAX_ATTEMPTS, 600);
  if (!attempt.allowed) throw new ApiError(429, "rate_limited", "Too many attempts. Request a new code in a few minutes.");

  if (!isReviewLogin(email, input.code)) {
    const [token] = await db.select().from(schema.loginTokens)
      .where(and(eq(schema.loginTokens.email, email), isNull(schema.loginTokens.usedAt), gt(schema.loginTokens.expiresAt, new Date())))
      .orderBy(desc(schema.loginTokens.createdAt)).limit(1);
    if (!token) throw new ApiError(400, "code_expired", "That code has expired. Request a new one.");
    if (!safeEqual(token.codeHash, hashCode(email, input.code.trim()))) {
      throw new ApiError(400, "code_invalid", "That code is not right. Check the email and try again.");
    }
    await db.update(schema.loginTokens).set({ usedAt: new Date() }).where(eq(schema.loginTokens.id, token.id));
  }

  let [host] = await db.select().from(schema.hosts).where(eq(schema.hosts.email, email)).limit(1);
  if (!host) {
    [host] = await db.insert(schema.hosts).values({ email, locale: input.locale, brand: input.brand })
      .onConflictDoNothing({ target: schema.hosts.email }).returning();
    if (!host) [host] = await db.select().from(schema.hosts).where(eq(schema.hosts.email, email)).limit(1);
  }
  if (!host) throw new ApiError(500, "server_error", "Could not create account");
  if (host.suspendedAt) throw accountSuspended();

  // Accept any pending co-host invites for this email.
  const invites = await db.select().from(schema.cohostInvites).where(eq(schema.cohostInvites.email, email));
  if (invites.length) {
    await db.insert(schema.occasionMembers)
      .values(invites.map((i) => ({ occasionId: i.occasionId, hostId: host!.id, role: "cohost" as const })))
      .onConflictDoNothing();
    await db.delete(schema.cohostInvites).where(eq(schema.cohostInvites.email, email));
  }

  return { token: await signSession(host.id), host };
}
