import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { BRANDS, brandBaseUrl, type Brand, type Locale } from "./config";
import { makeT } from "@/i18n/shared";
import { ApiError } from "./http";
import { hmac, requireEnv, sha256 } from "./crypto";
import { normalizeEmail } from "./auth";
import { emailConfigured, sendGuestGalleryEmail, sendMarketingRaw } from "./email";
import { accessForOccasions } from "./access";
import { getSettings } from "./settings";
import { paymentsEnabled } from "./stripe";
import { guestPurchaseOffered } from "./purchase-rules";
import { publicSlug } from "./occasion";

/**
 * Guest email (optional) and marketing consent (UK GDPR / PECR).
 *  - guest_contacts: a guest asked to get the event's photos when the gallery ends. That email is transactional
 *    (they requested it) and carries nothing but the gallery link and the event's own offer.
 *  - marketing_consents: opt-in only, never pre-ticked, never bundled with anything else. Each row keeps the exact
 *    wording shown, the locale, the source and when; withdrawal sets withdrawn_at on every current consent of that
 *    email + brand. sendMarketingEmail() refuses to send without a current consent and always adds the unsubscribe
 *    link and the one-click List-Unsubscribe headers.
 */

const C = schema.marketingConsents;
const G = schema.guestContacts;
type ConsentRow = typeof C.$inferSelect;
export type ConsentSource = "guest_upload" | "host_signup" | "host_settings";
export type WithdrawVia = "unsubscribe_link" | "list_unsubscribe" | "host_settings" | "admin" | "account_deleted";

const unsubSecret = () => process.env.UNSUBSCRIBE_SECRET || requireEnv("AUTH_SECRET", 16);

/** The unsubscribe token of a consent row: HMAC(secret, id). Only sha256(token) is stored. */
export function unsubscribeToken(consentId: string): string {
  return hmac(unsubSecret(), `unsub:${consentId}`);
}
const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;

/** The exact text shown next to the marketing checkbox (guest card or host sign-in / settings). */
export function consentWording(locale: Locale, brand: Brand, source: ConsentSource): string {
  const name = BRANDS[brand].name;
  return source === "guest_upload" ? makeT(locale, "guest")("emailOffer.marketing", { brand: name }) : makeT(locale, "host")("marketing.optIn", { brand: name });
}

export function ipHashOf(ip: string): string {
  return hmac(requireEnv("GUEST_TOKEN_SECRET", 16), `consent-ip:${ip}`);
}

/** The newest current (not withdrawn) consent for this email and brand. */
export async function currentConsent(email: string, brand: Brand): Promise<ConsentRow | null> {
  const [row] = await db.select().from(C)
    .where(and(eq(C.email, normalizeEmail(email)), eq(C.brand, brand), eq(C.consented, true), isNull(C.withdrawnAt)))
    .orderBy(desc(C.consentedAt)).limit(1);
  return row ?? null;
}

/**
 * Records an opt-in. If a current consent already exists for this email + brand it is kept (no duplicate row).
 * `wording` must be exactly what was shown; callers use consentWording().
 */
export async function recordConsent(input: {
  email: string; brand: Brand; locale: Locale; source: ConsentSource; wording: string;
  occasionId?: string | null; ip?: string | null; userAgent?: string | null;
}): Promise<ConsentRow> {
  const email = normalizeEmail(input.email);
  const existing = await currentConsent(email, input.brand);
  if (existing) return existing;
  const id = randomUUID();
  const [row] = await db.insert(C).values({
    id, email, brand: input.brand, locale: input.locale, consented: true, wording: input.wording.slice(0, 1000), source: input.source,
    occasionId: input.occasionId ?? null, ipHash: input.ip ? ipHashOf(input.ip) : null, userAgent: input.userAgent ? input.userAgent.slice(0, 200) : null,
    unsubscribeTokenHash: sha256(unsubscribeToken(id)),
  }).returning();
  return row!;
}

/** Withdraws every current consent for this email + brand. Returns how many were withdrawn. */
export async function withdrawConsent(email: string, brand: Brand | "all", via: WithdrawVia): Promise<number> {
  const rows = await db.update(C).set({ withdrawnAt: new Date(), withdrawnVia: via })
    .where(and(eq(C.email, normalizeEmail(email)), brand === "all" ? undefined : eq(C.brand, brand), isNull(C.withdrawnAt)))
    .returning({ id: C.id });
  return rows.length;
}

/** Unsubscribe link / one-click POST: withdraws that consent (and every other current one for the same email + brand). */
export async function withdrawByToken(token: string, via: WithdrawVia): Promise<{ email: string; brand: Brand; locale: Locale } | null> {
  if (!TOKEN_RE.test(token)) return null;
  const [row] = await db.select().from(C).where(eq(C.unsubscribeTokenHash, sha256(token))).limit(1);
  if (!row) return null;
  await withdrawConsent(row.email, row.brand, via);
  return { email: row.email, brand: row.brand, locale: row.locale === "tr" ? "tr" : "en" };
}

/** Unsubscribe URLs for one consent: the page (visible link) and the RFC 8058 one-click POST endpoint. */
export function unsubscribeUrls(c: Pick<ConsentRow, "id" | "brand" | "locale">) {
  const token = unsubscribeToken(c.id);
  const base = brandBaseUrl(c.brand);
  return { pageUrl: `${base}/unsubscribe/${token}?lang=${c.locale === "tr" ? "tr" : "en"}`, oneClickUrl: `${base}/api/v1/unsubscribe/${token}` };
}

/**
 * The ONLY way to send a marketing email. Refuses (409 `no_consent`) unless the address has a current consent for this
 * brand; adds the visible unsubscribe link and the List-Unsubscribe / List-Unsubscribe-Post headers. No campaigns yet.
 */
export async function sendMarketingEmail(to: string, brand: Brand, content: {
  subject: string; heading: string; body: string[]; cta?: { href: string; label: string };
}): Promise<void> {
  const consent = await currentConsent(to, brand);
  if (!consent) throw new ApiError(409, "no_consent", "No current marketing consent for this address");
  if (!emailConfigured()) throw new ApiError(503, "email_unavailable", "Email is not configured");
  const locale: Locale = consent.locale === "tr" ? "tr" : "en";
  const t = makeT(locale, "common");
  const urls = unsubscribeUrls(consent);
  await sendMarketingRaw(consent.email, {
    brand, subject: content.subject, heading: content.heading, body: content.body, cta: content.cta,
    footer: t("marketingEmail.footer", { brand: BRANDS[brand].name }),
    unsubscribe: { ...urls, label: t("marketingEmail.unsubscribe") },
  });
}

// ── Guest contacts ─────────────────────────────────────────────────────────────────────────────────

/** A guest asks for the event's photos by email (upsert per event + email). */
export async function recordGuestContact(input: { occasionId: string; guestId: string | null; email: string; locale: Locale; brand: Brand }) {
  const email = normalizeEmail(input.email);
  await db.insert(G).values({ occasionId: input.occasionId, guestId: input.guestId, email, locale: input.locale, brand: input.brand, wantsEventPhotos: true })
    .onConflictDoUpdate({ target: [G.occasionId, G.email], set: { guestId: input.guestId, locale: input.locale, brand: input.brand, wantsEventPhotos: true } });
}

const O = schema.occasions;

/**
 * When a gallery has ended, emails each guest who asked (wants_event_photos) a link to the gallery and, when it can be
 * bought, the event's "download everything" offer. Claimed per row with a conditional UPDATE (photos_emailed_at), so the
 * cron and the lazy triggers never send twice; a failed send releases the claim for the next run.
 */
export async function sendGuestGalleryEmails(opts: { occasionIds?: string[]; max?: number } = {}): Promise<number> {
  if (!emailConfigured()) return 0;
  const now = new Date();
  const due = db.select({ id: G.id }).from(G).innerJoin(O, eq(O.id, G.occasionId)).where(and(
    eq(G.wantsEventPhotos, true), isNull(G.photosEmailedAt),
    inArray(O.packageStatus, ["paid", "live", "ended"]), isNotNull(O.closesAt), lte(O.closesAt, now), ne(O.status, "archived"), isNull(O.adminLockedAt),
    opts.occasionIds ? inArray(G.occasionId, opts.occasionIds) : undefined,
  )).limit(opts.max ?? 200);
  const claimed = await db.update(G).set({ photosEmailedAt: now })
    .where(and(inArray(G.id, due), isNull(G.photosEmailedAt)))
    .returning({ id: G.id, occasionId: G.occasionId, email: G.email, locale: G.locale, brand: G.brand });
  if (!claimed.length) return 0;
  const events = await db.select().from(O).where(inArray(O.id, [...new Set(claimed.map((c) => c.occasionId))]));
  const [access, s] = await Promise.all([accessForOccasions(events, now), getSettings()]);
  const byId = new Map(events.map((o) => [o.id, o]));
  let sent = 0;
  for (const c of claimed) {
    const o = byId.get(c.occasionId);
    const a = access.get(c.occasionId);
    // Only for a gallery guests can still open (not refunded, expired or suspended).
    if (!o || !a || !a.guestsCanView) continue;
    const offer = paymentsEnabled() && guestPurchaseOffered({ paid: a.paid, guestsCanView: a.guestsCanView, canDownload: a.canDownload });
    const locale: Locale = c.locale === "tr" ? "tr" : "en";
    try {
      await sendGuestGalleryEmail(c.email, {
        locale, brand: c.brand, title: o.title, url: `${brandBaseUrl(o.brand)}/g/${publicSlug(o)}?lang=${locale}`, offerPence: offer ? s.guestDownloadPence : null,
      });
      sent++;
    } catch (e) {
      console.error("[consent] guest gallery email failed", e);
      await db.update(G).set({ photosEmailedAt: null }).where(eq(G.id, c.id)).catch(() => {});
    }
  }
  return sent;
}

// ── Admin ──────────────────────────────────────────────────────────────────────────────────────────

export const CONSENT_STATUS = ["current", "withdrawn"] as const;
export type ConsentStatus = (typeof CONSENT_STATUS)[number];

export function consentWhere(f: { brand?: Brand | null; status?: ConsentStatus | null; q?: string | null }) {
  return and(
    f.brand ? eq(C.brand, f.brand) : undefined,
    f.status === "current" ? and(eq(C.consented, true), isNull(C.withdrawnAt)) : f.status === "withdrawn" ? isNotNull(C.withdrawnAt) : undefined,
    f.q ? sql`${C.email} ilike ${`%${f.q.replace(/[\\%_]/g, (x) => `\\${x}`)}%`}` : undefined,
  );
}
