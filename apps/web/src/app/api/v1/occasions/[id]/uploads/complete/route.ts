import { route, json, readJson } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { completeBodySchema, completeUploads } from "@/lib/uploads";

// Uploads are processed (previews, watermarks, video transcodes) after the response; see src/lib/media-processing.ts.
export const runtime = "nodejs";
export const maxDuration = 300;

/** Additive: completes host uploads (mirror of /g/:slug/uploads/complete). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const { host, occasion } = await requireMember(id);
  const { mediaIds } = await readJson(req, completeBodySchema);
  const { missing } = await completeUploads(occasion, mediaIds, { hostId: host.id });
  return json({ ok: true, missing });
});
