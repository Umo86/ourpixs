import { route, json, readJson } from "@/lib/http";
import { requireHost } from "@/lib/auth";
import { limit } from "@/lib/rate-limit";
import { requestBrand } from "@/lib/request";
import { createOccasion, createSchema, occasionPayload, summariesFor } from "@/lib/occasion-service";

export const GET = route(async () => {
  const host = await requireHost();
  return json({ occasions: await summariesFor(host.id) });
});

export const POST = route(async (req) => {
  const host = await requireHost();
  await limit(`occ:create:${host.id}`, 20, 86400);
  const body = await readJson(req, createSchema);
  const { occasion: o, trialStarted } = await createOccasion(host.id, requestBrand(req), body);
  // `trialStarted` is true when this (first) event started the host's free trial.
  return json({ occasion: await occasionPayload(o, "owner"), trialStarted }, { status: 201 });
});
