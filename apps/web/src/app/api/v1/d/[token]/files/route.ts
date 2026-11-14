import { z } from "zod";
import { route, json, notFound, readQuery, clientIp } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { sha256 } from "@/lib/crypto";
import { purchaseFromToken, purchaseManifest } from "@/lib/guest-purchase";

/** ZIP manifest for the emailed link: every original with FRESH signed links (1 h), minted per request. `?dayId=<uuid>|none`. */
export const GET = route<{ token: string }>(async (req, { token }) => {
  await limit(`d:ip:${clientIp(req)}`, 60, 600);
  await limit(`d:t:${sha256(token).slice(0, 24)}`, 120, 3600);
  const q = readQuery(req, z.object({ dayId: z.union([z.string().uuid(), z.literal("none")]).optional() }));
  const r = await purchaseFromToken(token);
  if (!r) throw notFound("This download link isn't valid any more");
  const files = await purchaseManifest(r.occasion, q.dayId);
  return json({ files, totalBytes: files.reduce((a, f) => a + f.bytes, 0) });
});
