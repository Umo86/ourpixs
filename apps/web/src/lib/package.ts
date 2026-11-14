import "server-only";
import { after } from "next/server";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { emailConfigured, sendFairUseAlert, sendGalleryEndedEmail } from "./email";
import { adminEmails } from "./admin";
import { getSettings } from "./settings";
import { addMonths } from "./window";
import type { Access } from "./access-rules";
import { sendGuestGalleryEmails } from "./consent";

/**
 * Event package lifecycle side effects (the rules themselves are in access.ts):
 *  - the "gallery has ended" email, claimed once (cron daily, plus lazily whenever an ended event is touched), and the
 *    guests' "here are the photos" emails for guests who asked (src/lib/consent.ts);
 *  - ending a gallery early;
 *  - the fair-use flag and admin alert.
 */

type OccasionRow = typeof schema.occasions.$inferSelect;
const O = schema.occasions;
const loc = (l: string) => (l === "tr" ? "tr" : "en") as "en" | "tr";

/**
 * Claims and sends the "gallery ended" email for one event (or every due event when `ids` is omitted, up to `max`).
 * The claim is a conditional UPDATE (ended_email_sent_at is null, closes_at ≤ now, paid states only), so the
 * cron and the lazy trigger can never both send it. It also records package_status = 'ended'.
 * When email isn't configured the state is still recorded but the email marker stays empty.
 */
export async function sendDueEndedEmails(opts: { ids?: string[]; max?: number; deadline?: number } = {}): Promise<number> {
  const now = new Date();
  const due = and(
    inArray(O.packageStatus, ["paid", "live", "ended"]), isNull(O.endedEmailSentAt), lte(O.closesAt, now),
    opts.ids ? inArray(O.id, opts.ids) : undefined,
  );
  if (!emailConfigured()) {
    await db.update(O).set({ packageStatus: "ended" }).where(and(due, inArray(O.packageStatus, ["paid", "live"])));
    return 0;
  }
  const batch = db.select({ id: O.id }).from(O).where(due).limit(opts.max ?? 100);
  const claimed = await db.update(O).set({ endedEmailSentAt: now, packageStatus: "ended" })
    .where(and(inArray(O.id, batch), isNull(O.endedEmailSentAt)))
    .returning({ id: O.id, title: O.title, ownerId: O.ownerId, deleteAfter: O.deleteAfter });
  if (!claimed.length) return 0;
  const owners = await db.select({ id: schema.hosts.id, email: schema.hosts.email, locale: schema.hosts.locale, brand: schema.hosts.brand })
    .from(schema.hosts).where(inArray(schema.hosts.id, [...new Set(claimed.map((c) => c.ownerId))]));
  const byId = new Map(owners.map((h) => [h.id, h]));
  let sent = 0;
  for (const [i, c] of claimed.entries()) {
    // Out of time (`deadline`, epoch ms): release the rest of the claims so the next run sends them.
    if (opts.deadline && Date.now() > opts.deadline) {
      await db.update(O).set({ endedEmailSentAt: null }).where(inArray(O.id, claimed.slice(i).map((x) => x.id))).catch(() => {});
      break;
    }
    const h = byId.get(c.ownerId);
    if (!h) continue;
    try {
      await sendGalleryEndedEmail(h.email, { locale: loc(h.locale), brand: h.brand, title: c.title, occasionId: c.id, deleteAfter: c.deleteAfter });
      sent++;
    } catch (e) {
      // Release the claim so the next run retries.
      console.error("[package] ended email failed", e);
      await db.update(O).set({ endedEmailSentAt: null }).where(eq(O.id, c.id)).catch(() => {});
    }
  }
  return sent;
}

/**
 * Lazy trigger: when a page or API touches an event whose window is over and the email hasn't gone yet,
 * send it after the response (Vercel Hobby crons run once a day, so this closes the gap).
 */
export function touchEnded(o: Pick<OccasionRow, "id" | "endedEmailSentAt">, a: Access) {
  if (a.state !== "ended" || o.endedEmailSentAt) return;
  try {
    after(async () => {
      await sendDueEndedEmails({ ids: [o.id] }).catch((e) => console.error("[package] lazy ended email", e));
      await sendGuestGalleryEmails({ occasionIds: [o.id] }).catch((e) => console.error("[package] lazy guest emails", e));
    });
  } catch {
    // Outside a request scope (scripts): nothing to do.
  }
}

/** The organiser closes the gallery now: guest uploads stop, retention counts from now. */
export async function endGalleryNow(o: OccasionRow) {
  const now = new Date();
  const s = await getSettings();
  await db.update(O).set({ closesAt: now, packageStatus: "ended", deleteAfter: addMonths(now, s.retentionMonths) })
    .where(and(eq(O.id, o.id), inArray(O.packageStatus, ["paid", "live"])));
  try {
    after(async () => {
      await sendDueEndedEmails({ ids: [o.id] }).catch((e) => console.error("[package] end-now email", e));
      await sendGuestGalleryEmails({ occasionIds: [o.id] }).catch((e) => console.error("[package] end-now guest emails", e));
    });
  } catch {
    await sendDueEndedEmails({ ids: [o.id] }).catch(() => {});
    await sendGuestGalleryEmails({ occasionIds: [o.id] }).catch(() => {});
  }
}

/** Bytes stored for an event (uploaded, not deleted). */
export async function eventBytes(occasionId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${schema.media.bytes}), 0)::bigint` }).from(schema.media)
    .where(and(eq(schema.media.occasionId, occasionId), eq(schema.media.status, "uploaded"), sql`${schema.media.visibility} <> 'deleted'`));
  return Number(r?.n ?? 0);
}

const GB = 1024 ** 3;

/**
 * Fair use: past settings.fairUseGb, uploads keep working, but the event is flagged (fair_use_alerted_at, shown in admin)
 * and admins get ONE email. The flag is claimed with a conditional UPDATE, so concurrent uploads alert once.
 */
export async function checkFairUse(o: Pick<OccasionRow, "id" | "title" | "ownerId" | "fairUseAlertedAt">) {
  if (o.fairUseAlertedAt) return;
  const [s, bytes] = await Promise.all([getSettings(), eventBytes(o.id)]);
  if (bytes <= s.fairUseGb * GB) return;
  const claimed = await db.update(O).set({ fairUseAlertedAt: new Date() }).where(and(eq(O.id, o.id), isNull(O.fairUseAlertedAt))).returning({ id: O.id });
  if (!claimed.length || !emailConfigured()) return;
  const [owner] = await db.select({ email: schema.hosts.email }).from(schema.hosts).where(eq(schema.hosts.id, o.ownerId)).limit(1);
  await sendFairUseAlert([...adminEmails()], { title: o.title, occasionId: o.id, ownerEmail: owner?.email ?? "?", gb: bytes / GB, limitGb: s.fairUseGb })
    .catch((e) => console.error("[package] fair-use alert email failed", e));
}
