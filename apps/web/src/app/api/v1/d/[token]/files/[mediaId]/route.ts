import { route, json, notFound, clientIp, assertUuid } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { sha256 } from "@/lib/crypto";
import { purchasableOriginalUrl, purchaseFromToken } from "@/lib/guest-purchase";

/** One original for the emailed link → `{ url }` (signed, 1 h, minted now). */
export const GET = route<{ token: string; mediaId: string }>(async (req, { token, mediaId }) => {
  assertUuid(mediaId, "photo");
  await limit(`d:ipf:${clientIp(req)}`, 300, 600);
  await limit(`d:tf:${sha256(token).slice(0, 24)}`, 600, 3600);
  const r = await purchaseFromToken(token);
  if (!r) throw notFound("This download link isn't valid any more");
  const url = await purchasableOriginalUrl(r.occasion, mediaId);
  if (!url) throw notFound("Unknown photo");
  return json({ url });
});
