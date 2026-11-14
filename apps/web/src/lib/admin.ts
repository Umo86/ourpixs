import "server-only";
import { notFound, redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { getSession, normalizeEmail, type HostRow } from "./auth";
import { ApiError, forbidden, notFound as notFoundError, route } from "./http";
import { limit } from "./rate-limit";

/**
 * Superadmin access (/admin pages and /api/admin routes). Server-side only; the client is never trusted.
 *  - Admins are signed-in hosts whose email is in ADMIN_EMAILS (comma-separated, case-insensitive).
 *  - Everyone else — signed out, not listed, suspended, or ADMIN_EMAILS unset — gets a plain 404, so the area is invisible.
 *  - Admin sessions must be fresh: the JWT has to be issued within the last ADMIN_SESSION_HOURS, otherwise sign in again.
 *  - Every mutation is rate-limited, origin-checked and written to admin_audit.
 */

export const ADMIN_SESSION_HOURS = 12;
const MUTATIONS_PER_MINUTE = 60;

export function adminEmails(): Set<string> {
  return new Set((process.env.ADMIN_EMAILS || "").split(",").map((e) => normalizeEmail(e)).filter((e) => e.includes("@")));
}
export const isAdminEmail = (email: string) => adminEmails().has(normalizeEmail(email));

type Resolved = { ok: true; admin: HostRow } | { ok: false; why: "none" | "stale" };

async function resolveAdmin(): Promise<Resolved> {
  const list = adminEmails();
  if (!list.size) return { ok: false, why: "none" };
  const s = await getSession().catch(() => null);
  if (!s || s.host.suspendedAt || !list.has(normalizeEmail(s.host.email))) return { ok: false, why: "none" };
  const fresh = !!s.issuedAt && Date.now() - s.issuedAt.getTime() < ADMIN_SESSION_HOURS * 3600_000;
  if (!fresh) return { ok: false, why: "stale" };
  return { ok: true, admin: s.host };
}

/** The admin host or null, without redirecting (e.g. metadata, so nothing about /admin shows to others). */
export async function currentAdmin(): Promise<HostRow | null> {
  const r = await resolveAdmin();
  return r.ok ? r.admin : null;
}

/** Pages: the admin host, a 404 for everyone else, or a re-login for an admin whose sign-in is older than 12 hours. */
export async function requireAdmin(): Promise<HostRow> {
  const r = await resolveAdmin();
  if (r.ok) return r.admin;
  if (r.why === "stale") redirect("/login?next=/admin&reauth=1");
  notFound();
}

/**
 * Route handlers: the admin host, or ApiError 404 (not an admin) / 401 reauth_required (admin, stale sign-in).
 * Mutations (anything but GET/HEAD) authenticated by the session cookie must come from this site's own origin.
 */
export async function requireAdminApi(req?: NextRequest): Promise<HostRow> {
  const r = await resolveAdmin();
  if (!r.ok) {
    if (r.why === "stale") throw new ApiError(401, "reauth_required", "Please sign in again");
    throw notFoundError();
  }
  if (req && req.method !== "GET" && req.method !== "HEAD" && !req.headers.get("authorization")) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    let originHost: string | null = null;
    try { originHost = origin ? new URL(origin).host : null; } catch { originHost = null; }
    if (!originHost || !host || originHost !== host) throw forbidden("Cross-site request");
  }
  return r.admin;
}

/**
 * Wraps an admin route handler: admin check, CSRF origin check and a per-admin rate limit on mutations,
 * and the standard JSON error shape.
 */
export function adminRoute<P extends Record<string, string> = Record<string, never>>(
  handler: (req: NextRequest, params: P, admin: HostRow) => Promise<Response>,
) {
  return route<P>(async (req, params) => {
    const admin = await requireAdminApi(req);
    if (req.method !== "GET" && req.method !== "HEAD") await limit(`admin:mut:${admin.id}`, MUTATIONS_PER_MINUTE, 60);
    return handler(req, params, admin);
  });
}

export type AuditTarget = "host" | "occasion" | "media" | "guest" | "lead" | "cron" | "settings";

/** One row per mutating admin action, written once the action has succeeded (target ids are plain text, so rows outlive deleted targets). */
export async function audit(admin: Pick<HostRow, "id" | "email">, action: string, targetType: AuditTarget, targetId: string | null, details: Record<string, unknown> = {}) {
  await db.insert(schema.adminAudit).values({ adminHostId: admin.id, adminEmail: admin.email, action, targetType, targetId, details });
}

/** Reason typed into every confirm dialog (saved to the audit log). */
export const reasonSchema = z.string().trim().min(3).max(500);
export const optionalReason = z.string().trim().max(500).optional().nullable();

/** ILIKE pattern for a user's search text (wildcards escaped, so `%` and `_` match literally). */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Page number from ?page= (1-based, capped). */
export function pageParam(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : 1;
}
export const PAGE = 50;

/** First value of a search param. */
export const sp1 = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
