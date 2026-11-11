import { z } from "zod";
import { db, schema } from "@/db";
import { route, json, readJson } from "@/lib/http";
import { requireHost } from "@/lib/auth";

const body = z.object({ token: z.string().min(10).max(300), platform: z.enum(["ios", "android"]) });

export const POST = route(async (req) => {
  const host = await requireHost();
  const b = await readJson(req, body);
  await db.insert(schema.pushTokens).values({ hostId: host.id, token: b.token, platform: b.platform })
    .onConflictDoUpdate({ target: schema.pushTokens.token, set: { hostId: host.id, platform: b.platform } });
  return json({ ok: true });
});
