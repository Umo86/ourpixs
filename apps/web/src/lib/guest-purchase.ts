import "server-only";
import type Stripe from "stripe";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { BRANDS, CANCELLATION_DAYS, MAIN_BRAND, brandBaseUrl, type Locale, type PackageSettings } from "./config";
import { ApiError } from "./http";
import { accessForOccasion, type Access } from "./access";
import { getSettings } from "./settings";
import { paymentsEnabled, stripe } from "./stripe";
import { randomToken, sha256 } from "./crypto";
import { publicSlug, revealedForGuests } from "./occasion";
import { liveMedia, loadDays, mediaPage } from "./queries";
import { EXT_BY_MIME, privateGetUrl } from "./storage";
import { emailConfigured, sendGuestDownloadEmail } from "./email";
import { guestMayDownloadOriginal, guestPurchaseOffered, purchaseActive, PURCHASE_VALID_DAYS, SPLIT_ZIP_BYTES, type PurchaseSummary } from "./purchase-rules";
export type { PurchaseSummary } from "./purchase-rules";
import { makeT } from "@/i18n/shared";

/**
 * Guests buy "download everything" for one event (default £3, settings.guestDownloadPence): every photo and video in
 * full quality, as signed, expiring links, for 30 days. Stripe Checkout (mode payment; card, Apple Pay, Google Pay),
 * tied to the guest's device token (guest_id) and the email Checkout collects.
 *
 * Same protections as the event package (src/lib/billing.ts): the webhook re-reads the session from Stripe, marking
 * paid is a conditional UPDATE (pending → paid), refunds are never undone by a late "completed" event, and only a
 * HASH of the emailed download token is stored.
 */

type OccasionRow = typeof schema.occasions.$inferSelect;
type GuestRow = typeof schema.guests.$inferSelect;
export type PurchaseRow = typeof schema.guestPurchases.$inferSelect;

export const GUEST_DOWNLOAD_KIND = "guest_download";
const P = schema.guestPurchases;
const DAY = 86400_000;
const idOf = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id ?? null);

/** The guest's current purchase for this event (paid and inside its 30 days), if any. */
export async function activePurchase(occasionId: string, guestId: string | null | undefined): Promise<PurchaseRow | null> {
  if (!guestId) return null;
  const [row] = await db.select().from(P)
    .where(and(eq(P.occasionId, occasionId), eq(P.guestId, guestId), eq(P.status, "paid"), gt(P.tokenExpiresAt, new Date())))
    .orderBy(desc(P.paidAt)).limit(1);
  return row ?? null;
}

/** PublicOccasion.guestDownload */
export type GuestDownloadInfo = { pricePence: number; available: boolean; payments: boolean; purchased: boolean; expiresAt: string | null };

export function guestDownloadInfo(access: Access, s: PackageSettings, purchase: PurchaseRow | null): GuestDownloadInfo {
  const offered = guestPurchaseOffered({ paid: access.paid, guestsCanView: access.guestsCanView, canDownload: access.canDownload });
  return {
    pricePence: s.guestDownloadPence,
    available: offered && paymentsEnabled(),
    payments: paymentsEnabled(),
    purchased: offered && purchaseActive(purchase),
    expiresAt: purchase?.tokenExpiresAt?.toISOString() ?? null,
  };
}

/** POST /api/v1/g/:slug/purchase → Stripe Checkout URL. */
export async function createGuestCheckout(o: OccasionRow, guest: GuestRow, locale: Locale): Promise<string> {
  if (!paymentsEnabled()) throw new ApiError(503, "payments_unavailable", "Payments are coming soon");
  const access = await accessForOccasion(o);
  if (!guestPurchaseOffered({ paid: access.paid, guestsCanView: access.guestsCanView, canDownload: access.canDownload })) {
    throw new ApiError(409, "cannot_pay", "Downloads can't be bought for this gallery right now");
  }
  if (await activePurchase(o.id, guest.id)) throw new ApiError(409, "already_paid", "You already have every photo and video from this event");
  const s = await getSettings();
  const t = makeT(locale, "guest");
  const base = `${brandBaseUrl(o.brand)}/g/${publicSlug(o)}`;
  // The guest ticked this before Checkout (the route refuses without it); stored with the exact wording.
  const waiver = t("purchase.waiver", { days: CANCELLATION_DAYS });
  const meta = { kind: GUEST_DOWNLOAD_KIND, occasionId: o.id, guestId: guest.id };
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: guest.id,
    locale: locale === "tr" ? "tr" : "en-GB",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: s.guestDownloadPence,
        tax_behavior: "inclusive",
        product_data: { name: `${BRANDS[MAIN_BRAND].name} · ${t("purchase.productName")}`, description: o.title.slice(0, 200) },
      },
    }],
    metadata: meta,
    payment_intent_data: { metadata: meta },
    custom_text: { submit: { message: waiver.slice(0, 1200) } },
    success_url: `${base}/download?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: base,
  });
  if (!session.url) throw new ApiError(502, "payments_unavailable", "Could not start checkout");
  await db.insert(P).values({
    occasionId: o.id, guestId: guest.id, amountPence: s.guestDownloadPence, currency: "gbp", stripeCheckoutSessionId: session.id,
    status: "pending", livemode: session.livemode, locale, brand: o.brand, waiverAcceptedAt: new Date(), waiverWording: waiver,
  }).onConflictDoNothing({ target: P.stripeCheckoutSessionId });
  return session.url;
}

/**
 * checkout.session.completed / async_payment_succeeded for kind "guest_download" (also called from the success page,
 * so a slow webhook never leaves the guest waiting). Idempotent.
 */
export async function fulfilGuestPurchase(sessionId: string): Promise<{ applied: boolean; reason?: string; purchase?: PurchaseRow }> {
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
  if (session.mode !== "payment" || session.metadata?.kind !== GUEST_DOWNLOAD_KIND) return { applied: false, reason: "not_guest_download" };
  const occasionId = session.metadata?.occasionId;
  const guestId = session.metadata?.guestId || null;
  if (!occasionId) return { applied: false, reason: "no_metadata" };
  if (session.payment_status !== "paid") return { applied: false, reason: "not_paid" };
  if (session.currency !== "gbp" || !session.amount_total || session.amount_total <= 0) {
    console.error("[guest-purchase] unexpected amount/currency", { sessionId, amount: session.amount_total, currency: session.currency });
    return { applied: false, reason: "bad_amount" };
  }
  const [o] = await db.select({ id: schema.occasions.id, brand: schema.occasions.brand }).from(schema.occasions).where(eq(schema.occasions.id, occasionId)).limit(1);
  if (!o) {
    console.error("[guest-purchase] paid checkout for a missing event — refund by hand", { sessionId, occasionId });
    return { applied: false, reason: "no_event" };
  }
  const pi = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const charge = pi && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const refunded = !!charge && (charge.refunded || charge.amount_refunded >= (charge.amount || 0));
  const now = new Date();
  // The row normally exists from createGuestCheckout; recreate it from Stripe's data if that insert was lost.
  await db.insert(P).values({
    occasionId, guestId, amountPence: session.amount_total, currency: "gbp", stripeCheckoutSessionId: session.id,
    status: "pending", livemode: session.livemode, locale: session.locale === "tr" ? "tr" : "en", brand: o.brand,
  }).onConflictDoNothing({ target: P.stripeCheckoutSessionId });
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  if (refunded) {
    await db.update(P).set({ status: "refunded", refundedAt: now, downloadTokenHash: null, email, stripePaymentIntentId: idOf(session.payment_intent) })
      .where(eq(P.stripeCheckoutSessionId, session.id));
    return { applied: false, reason: "refunded" };
  }
  const updated = await db.update(P).set({
    status: "paid", paidAt: now, tokenExpiresAt: new Date(now.getTime() + PURCHASE_VALID_DAYS * DAY), email,
    stripePaymentIntentId: idOf(session.payment_intent), amountPence: session.amount_total, livemode: session.livemode,
  }).where(and(eq(P.stripeCheckoutSessionId, session.id), eq(P.status, "pending"))).returning();
  const [row] = updated.length ? updated : await db.select().from(P).where(eq(P.stripeCheckoutSessionId, session.id)).limit(1);
  if (row?.status === "paid") await sendDownloadLink(row);
  return { applied: updated.length > 0, purchase: row };
}

/**
 * Emails the /d/<token> link once. The token is minted here and only its hash is stored; the claim is a conditional
 * UPDATE, so concurrent webhook deliveries send one email. If sending fails the claim is released (Stripe retries).
 */
async function sendDownloadLink(p: PurchaseRow) {
  if (p.emailedAt || !p.email || !p.occasionId || !emailConfigured()) return;
  const token = randomToken(32);
  const claimed = await db.update(P).set({ emailedAt: new Date(), downloadTokenHash: sha256(token) })
    .where(and(eq(P.id, p.id), eq(P.status, "paid"), sql`${P.emailedAt} is null`)).returning({ id: P.id });
  if (!claimed.length) return;
  const [o] = await db.select({ title: schema.occasions.title }).from(schema.occasions).where(eq(schema.occasions.id, p.occasionId)).limit(1);
  try {
    await sendGuestDownloadEmail(p.email, {
      locale: p.locale === "tr" ? "tr" : "en", brand: p.brand, title: o?.title ?? "", url: `${brandBaseUrl(p.brand)}/d/${token}`,
      expiresAt: p.tokenExpiresAt ?? new Date(Date.now() + PURCHASE_VALID_DAYS * DAY),
    });
  } catch (e) {
    await db.update(P).set({ emailedAt: null }).where(eq(P.id, p.id)).catch(() => {});
    throw e;
  }
}

/** charge.refunded for a guest purchase: a FULL refund ends access and kills the token. Returns false if not ours. */
export async function handleGuestPurchaseRefund(paymentIntentId: string, charge: Stripe.Charge): Promise<{ found: boolean; applied: boolean }> {
  const [p] = await db.select().from(P).where(eq(P.stripePaymentIntentId, paymentIntentId)).limit(1);
  if (!p) return { found: false, applied: false };
  const full = charge.refunded || charge.amount_refunded >= charge.amount;
  if (!full) return { found: true, applied: false };
  await db.update(P).set({ status: "refunded", refundedAt: p.refundedAt ?? new Date(), downloadTokenHash: null }).where(eq(P.id, p.id));
  return { found: true, applied: true };
}

// ── Download access ─────────────────────────────────────────────────────────────────────────────

const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;

/** /d/<token>: hash lookup, paid, inside 30 days, event's downloads still open. Null when anything fails. */
export async function purchaseFromToken(token: string): Promise<{ purchase: PurchaseRow; occasion: OccasionRow; access: Access } | null> {
  if (!TOKEN_RE.test(token)) return null;
  const [row] = await db.select({ p: P, o: schema.occasions }).from(P).innerJoin(schema.occasions, eq(schema.occasions.id, P.occasionId))
    .where(eq(P.downloadTokenHash, sha256(token))).limit(1);
  if (!row || !purchaseActive(row.p) || row.o.status === "archived") return null;
  const access = await accessForOccasion(row.o);
  if (!access.canDownload) return null;
  return { purchase: row.p, occasion: row.o, access };
}

/** What a purchase covers: visible, approved, revealed photos and videos of the event (at download time). */
function purchasableWhere(o: OccasionRow) {
  const m = schema.media;
  return [...liveMedia(o.id), eq(m.visibility, "visible"), eq(m.approved, true), inArray(m.kind, ["photo", "video"]), revealedForGuests(o)];
}


export async function purchaseSummary(o: OccasionRow): Promise<PurchaseSummary> {
  const m = schema.media;
  const rows = await db.select({
    dayId: m.dayId, photos: sql<number>`(count(*) filter (where ${m.kind} = 'photo'))::int`, videos: sql<number>`(count(*) filter (where ${m.kind} = 'video'))::int`,
    bytes: sql<number>`coalesce(sum(${m.bytes}), 0)::bigint`,
  }).from(m).where(and(...purchasableWhere(o))).groupBy(m.dayId);
  const days = await loadDays(o.id);
  const byDay = new Map(rows.map((r) => [r.dayId, r]));
  const list = [...days.map((d) => ({ id: d.id as string | null, name: d.name as string | null })), { id: null, name: null }]
    .map((d) => ({ ...d, count: Number(byDay.get(d.id)?.photos ?? 0) + Number(byDay.get(d.id)?.videos ?? 0), bytes: Number(byDay.get(d.id)?.bytes ?? 0) }))
    .filter((d) => d.count > 0);
  const bytes = rows.reduce((a, r) => a + Number(r.bytes), 0);
  return {
    photos: rows.reduce((a, r) => a + Number(r.photos), 0), videos: rows.reduce((a, r) => a + Number(r.videos), 0), bytes, days: list,
    split: bytes > SPLIT_ZIP_BYTES && list.length > 1,
  };
}

function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}
const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "guest";

export type ManifestFile = { id: string; name: string; url: string; mime: string; kind: string; bytes: number; dayId: string | null; createdAt: string };

/**
 * ZIP manifest of originals with FRESH signed links (1 h), minted per request. `dayId` = one day only; "none" = items
 * without a day. Shared by the guest purchase endpoints (device and emailed token).
 */
export async function purchaseManifest(o: OccasionRow, dayId?: string | "none"): Promise<ManifestFile[]> {
  const m = schema.media;
  const where = [...purchasableWhere(o)];
  if (dayId === "none") where.push(sql`${m.dayId} is null`);
  else if (dayId) where.push(eq(m.dayId, dayId));
  const rows = await db.select({ media: m, guestName: schema.guests.displayName }).from(m)
    .leftJoin(schema.guests, eq(schema.guests.id, m.guestId))
    .where(and(...where)).orderBy(asc(m.createdAt), asc(m.id)).limit(20000);
  return Promise.all(rows.map(async (r, i) => {
    const x = r.media;
    const name = `${stamp(x.createdAt)}_${String(i + 1).padStart(4, "0")}_${safe(r.guestName || "host")}.${EXT_BY_MIME[x.mime] || (x.kind === "video" ? "mp4" : "jpg")}`;
    return { id: x.id, name, url: await privateGetUrl(x.keyOriginal, 3600, { download: name }), mime: x.mime, kind: x.kind, bytes: x.bytes, dayId: x.dayId, createdAt: x.createdAt.toISOString() };
  }));
}

/** One original for a buyer (or the uploader): a fresh signed link, or null if this media isn't covered. */
export async function purchasableOriginalUrl(o: OccasionRow, mediaId: string): Promise<string | null> {
  const m = schema.media;
  const [x] = await db.select().from(m).where(and(eq(m.id, mediaId), ...purchasableWhere(o))).limit(1);
  if (!x) return null;
  return privateGetUrl(x.keyOriginal, 3600, { download: `${x.id}.${EXT_BY_MIME[x.mime] || (x.kind === "video" ? "mp4" : "jpg")}` });
}

/**
 * A guest's single-original download (device token): own uploads always (free), anyone else's with an active purchase.
 * Throws 402 `purchase_required` otherwise.
 */
export async function guestOriginalUrl(o: OccasionRow, guest: GuestRow, mediaId: string): Promise<string> {
  const m = schema.media;
  const [x] = await db.select().from(m).where(and(eq(m.id, mediaId), ...liveMedia(o.id), inArray(m.kind, ["photo", "video"]))).limit(1);
  if (!x) throw new ApiError(404, "not_found", "Unknown photo");
  const own = x.guestId === guest.id;
  const [access, purchase] = await Promise.all([accessForOccasion(o), own ? Promise.resolve(null) : activePurchase(o.id, guest.id)]);
  const ok = guestMayDownloadOriginal({ mediaGuestId: x.guestId, viewerGuestId: guest.id, purchase, event: { guestsCanView: access.guestsCanView, canDownload: access.canDownload } });
  if (!ok) throw new ApiError(402, "purchase_required", "Get every photo and video in full quality to download this");
  if (!own) {
    const url = await purchasableOriginalUrl(o, mediaId);
    if (!url) throw new ApiError(404, "not_found", "Unknown photo");
    return url;
  }
  return privateGetUrl(x.keyOriginal, 3600, { download: `${x.id}.${EXT_BY_MIME[x.mime] || (x.kind === "video" ? "mp4" : "jpg")}` });
}

/** The first `limit` covered items (newest first) for the per-item list on the download pages. */
export async function purchaseItems(o: OccasionRow, limit = 300) {
  return mediaPage({ where: purchasableWhere(o), limit });
}
