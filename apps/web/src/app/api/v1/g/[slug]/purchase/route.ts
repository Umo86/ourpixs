import { route, json } from "@/lib/http";
import { occasionBySlug, requireGuest } from "@/lib/guest";
import { requestLocale } from "@/lib/request";
import { limit } from "@/lib/rate-limit";
import { activePurchase, createGuestCheckout, guestDownloadInfo, purchaseSummary } from "@/lib/guest-purchase";
import { accessForOccasion } from "@/lib/access";
import { getSettings } from "@/lib/settings";

/**
 * GET: this device's "download everything" state → `{ guestDownload, summary|null }` (summary only once bought).
 * POST: starts Stripe Checkout (mode payment, GBP, price = settings.guestDownloadPence) → `{ url }`.
 * Guest device token required. Only for a paid event that is live or ended (409 `cannot_pay` otherwise),
 * 409 `already_paid` when this device already has it, 503 `payments_unavailable` without Stripe. Web only.
 */
export const GET = route<{ slug: string }>(async (_req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  const [access, s, purchase] = await Promise.all([accessForOccasion(o), getSettings(), activePurchase(o.id, guest.id)]);
  const info = guestDownloadInfo(access, s, purchase);
  return json({ guestDownload: info, summary: info.purchased ? await purchaseSummary(o) : null });
});

export const POST = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  await limit(`gp:${guest.id}`, 10, 3600);
  return json({ url: await createGuestCheckout(o, guest, requestLocale(req)) });
});
