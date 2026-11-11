import { z } from "zod";
import { route, json, readJson, planLimit } from "@/lib/http";
import { requireOrgMember } from "@/lib/org";
import { presignPut, storageDriver, StorageNotConfigured } from "@/lib/storage";
import { randomToken } from "@/lib/crypto";

/** Presigned PUT for the partner logo (PNG/WebP/SVG-free raster). Then POST ./complete { key }. */
export const POST = route<{ orgId: string }>(async (req, { orgId }) => {
  const { org } = await requireOrgMember(orgId, { owner: true });
  if (!storageDriver()) throw new StorageNotConfigured();
  const b = await readJson(req, z.object({ mime: z.enum(["image/png", "image/webp", "image/jpeg"]), bytes: z.number().int().positive() }));
  if (b.bytes > 5 * 1024 * 1024) throw planLimit("Logo is too large");
  const key = `org/${org.id}/logo-${randomToken(12)}.${b.mime === "image/png" ? "png" : b.mime === "image/webp" ? "webp" : "jpg"}`;
  return json({ key, upload: await presignPut(key, b.mime, b.bytes) });
});
