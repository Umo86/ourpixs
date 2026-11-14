import { route, json, notFound, clientIp } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { sha256 } from "@/lib/crypto";
import { purchaseFromToken, purchaseSummary } from "@/lib/guest-purchase";

/**
 * Emailed download link (/d/<token>, valid 30 days): what the guest bought. 404 when the token is unknown, refunded,
 * expired, or the event's files are gone. Rate-limited per IP and per token.
 */
export const GET = route<{ token: string }>(async (req, { token }) => {
  await limit(`d:ip:${clientIp(req)}`, 60, 600);
  await limit(`d:t:${sha256(token).slice(0, 24)}`, 120, 3600);
  const r = await purchaseFromToken(token);
  if (!r) throw notFound("This download link isn't valid any more");
  return json({ title: r.occasion.title, expiresAt: r.purchase.tokenExpiresAt?.toISOString() ?? null, summary: await purchaseSummary(r.occasion) });
});
