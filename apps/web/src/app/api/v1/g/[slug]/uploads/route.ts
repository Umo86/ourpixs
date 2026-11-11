import { route, json, readJson } from "@/lib/http";
import { occasionBySlug, requireGuest } from "@/lib/guest";
import { createUploads, uploadsBodySchema } from "@/lib/uploads";

export const POST = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  const { files } = await readJson(req, uploadsBodySchema);
  return json({ uploads: await createUploads(o, files, { guest }) });
});
