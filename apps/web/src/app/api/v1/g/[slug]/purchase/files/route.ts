import { z } from "zod";
import { route, json, readQuery, ApiError } from "@/lib/http";
import { occasionBySlug, requireGuest } from "@/lib/guest";
import { limit } from "@/lib/rate-limit";
import { activePurchase, purchaseManifest } from "@/lib/guest-purchase";
import { accessForOccasion } from "@/lib/access";

/**
 * ZIP manifest for a guest who bought "download everything" on this device: every original with FRESH signed links
 * (1 h), minted per request. `?dayId=<uuid>|none`. 402 `purchase_required` without an active (paid, ≤30 days) purchase.
 */
export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  await limit(`gpf:${guest.id}`, 60, 600);
  const q = readQuery(req, z.object({ dayId: z.union([z.string().uuid(), z.literal("none")]).optional() }));
  const [purchase, access] = await Promise.all([activePurchase(o.id, guest.id), accessForOccasion(o)]);
  if (!purchase || !access.canDownload) throw new ApiError(402, "purchase_required", "Get every photo and video in full quality first");
  const files = await purchaseManifest(o, q.dayId);
  return json({ files, totalBytes: files.reduce((a, f) => a + f.bytes, 0) });
});
