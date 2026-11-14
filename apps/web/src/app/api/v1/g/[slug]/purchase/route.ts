import { z } from "zod";
import { route, json, readJson, ApiError } from "@/lib/http";
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
 * POST body: `{ acceptImmediateSupply: true, locale? }` — the guest ticked "Start my download now; I understand I lose my
 * 14-day right to cancel" (Consumer Contracts Regulations 2013, digital content). Without it: 400 `waiver_required`.
 * The time and the exact wording are stored on the purchase.
 */
const postBody = z.object({ acceptImmediateSupply: z.boolean().optional(), locale: z.enum(["en", "tr"]).optional() });
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
  const b = await readJson(req, postBody);
  if (b.acceptImmediateSupply !== true) throw new ApiError(400, "waiver_required", "Please confirm you want the download straight away");
  return json({ url: await createGuestCheckout(o, guest, b.locale ?? requestLocale(req)) });
});
