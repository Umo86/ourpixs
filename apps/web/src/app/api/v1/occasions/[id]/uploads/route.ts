import { route, json, readJson } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { createUploads, uploadsBodySchema } from "@/lib/uploads";

/** Host uploads — same request/response shape as the guest uploads endpoint. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const { host, occasion } = await requireMember(id);
  const { files } = await readJson(req, uploadsBodySchema);
  return json({ uploads: await createUploads(occasion, files, { hostId: host.id }) });
});
