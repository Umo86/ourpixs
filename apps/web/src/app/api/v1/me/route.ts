import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson } from "@/lib/http";
import { requireHost, SESSION_COOKIE } from "@/lib/auth";
import { toHost } from "@/lib/serializers";
import { deleteAccount } from "@/lib/account";
import { currentConsent } from "@/lib/consent";
import { requestBrand } from "@/lib/request";
import type { NextRequest } from "next/server";

type HostRow = typeof schema.hosts.$inferSelect;
/** `marketing.consented`: a current opt-in to offers and news for this site's brand (change it with PUT /me/marketing). */
const payload = async (h: HostRow, req: NextRequest) => ({ host: toHost(h), marketing: { consented: !!(await currentConsent(h.email, requestBrand(req))) } });

/** The signed-in host. (No `subscription` any more: what an event can do is on each occasion's `access` / `package`.) */
export const GET = route(async (req) => json(await payload(await requireHost(), req)));

const body = z.object({ name: z.string().trim().max(80).nullable().optional(), locale: z.enum(["en", "tr"]).optional() });

export const PATCH = route(async (req) => {
  const host = await requireHost();
  const b = await readJson(req, body);
  const [updated] = await db.update(schema.hosts)
    .set({ ...(b.name !== undefined ? { name: b.name || null } : {}), ...(b.locale ? { locale: b.locale } : {}) })
    .where(eq(schema.hosts.id, host.id)).returning();
  return json(await payload(updated ?? host, req));
});

/** Deletes the host account, events they own (with all files) and memberships. */
export const DELETE = route(async () => {
  const host = await requireHost();
  await deleteAccount(host.id);
  const res = json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
});
