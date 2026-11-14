import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { processMediaIds, verifyProcessing } from "@/lib/media-processing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Video transcoding needs long functions: check your Vercel plan's maximum duration (docs/SETUP.md). */
export const maxDuration = 300;

const body = z.object({ ids: z.array(z.string().uuid()).min(1).max(20), exp: z.number().int(), sig: z.string().min(20).max(200) });

/**
 * Internal: makes the guest previews, watermarks and video transcodes for uploaded media (src/lib/media-processing.ts).
 * Called (fire-and-forget) by the upload completion requests and never by browsers. Auth: HMAC of the ids + expiry
 * with a key derived from CRON_SECRET (or GUEST_TOKEN_SECRET). Answers 202 at once and works after the response.
 */
export async function POST(req: NextRequest) {
  try {
    const { ids, exp, sig } = body.parse(await req.json().catch(() => ({})));
    if (!verifyProcessing(ids, exp, sig)) return errorJson(401, "unauthorized", "Bad signature");
    after(async () => {
      const r = await processMediaIds(ids, { budgetMs: 285_000 }).catch((e) => { console.error("[media] internal route failed", e); return null; });
      if (r) console.log("[media] processed", JSON.stringify(r));
    });
    return json({ accepted: ids.length }, { status: 202 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
