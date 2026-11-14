import { ApiError, json, route } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { accessForOccasion, assertWritable } from "@/lib/access";
import { endGalleryNow } from "@/lib/package";
import { occasionPayload } from "@/lib/occasion-service";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

/**
 * POST → { occasion }: ends a live gallery now (guest uploads close, retention counts from now, the "download
 * everything" email goes out). Owner and co-hosts. 409 not_live when the gallery isn't live.
 */
export const POST = route<{ id: string }>(async (_req, { id }) => {
  const { occasion, role } = await requireMember(id);
  const access = await accessForOccasion(occasion);
  assertWritable(access);
  if (!access.canEndEarly) throw new ApiError(409, "not_live", "The gallery isn't live, so there's nothing to end");
  await endGalleryNow(occasion);
  const [fresh] = await db.select().from(schema.occasions).where(eq(schema.occasions.id, occasion.id));
  return json({ occasion: await occasionPayload(fresh!, role) });
});
