import { z } from "zod";
import { db, schema } from "@/db";
import { route, json, readJson } from "@/lib/http";
import { requireHost } from "@/lib/auth";
import { limit } from "@/lib/rate-limit";
import { orgsForHost } from "@/lib/org";
import { orgPayload, orgSlug } from "@/lib/org-service";

/** Partner accounts the signed-in host belongs to. */
export const GET = route(async () => {
  const host = await requireHost();
  const rows = await orgsForHost(host.id);
  return json({ organisations: await Promise.all(rows.map((r) => orgPayload(r.org, r.role))) });
});

export const POST = route(async (req) => {
  const host = await requireHost();
  await limit(`org:create:${host.id}`, 5, 86400);
  const { name } = await readJson(req, z.object({ name: z.string().trim().min(2).max(80) }));
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(schema.organisations).values({ id, name, slug: orgSlug(name), supportEmail: host.email }),
    db.insert(schema.organisationMembers).values({ organisationId: id, hostId: host.id, role: "owner" }),
  ]);
  const rows = await orgsForHost(host.id);
  const mine = rows.find((r) => r.org.id === id)!;
  return json({ organisation: await orgPayload(mine.org, "owner") }, { status: 201 });
});
