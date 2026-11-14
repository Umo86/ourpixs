import { route, json, readJson } from "@/lib/http";
import { occasionBySlug, requireGuest } from "@/lib/guest";
import { completeBodySchema, completeUploads } from "@/lib/uploads";

// Uploads are processed (previews, watermarks, video transcodes) after the response; see src/lib/media-processing.ts.
export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  const { mediaIds } = await readJson(req, completeBodySchema);
  const { missing } = await completeUploads(o, mediaIds, { guest });
  // `missing` is additive: ids whose files never reached storage (client may retry them).
  return json({ ok: true, missing });
});
