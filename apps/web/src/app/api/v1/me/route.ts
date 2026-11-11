import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson } from "@/lib/http";
import { requireHost, SESSION_COOKIE } from "@/lib/auth";
import { toHost, toSubscription } from "@/lib/serializers";
import { computeAccess } from "@/lib/access";
import { deleteAccount } from "@/lib/account";

type HostRow = typeof schema.hosts.$inferSelect;
const payload = (h: HostRow) => ({ host: { ...toHost(h), subscription: toSubscription(computeAccess(h)) } });

/** `host.subscription` = the account's subscription and what it allows right now. */
export const GET = route(async () => json(payload(await requireHost())));

const body = z.object({ name: z.string().trim().max(80).nullable().optional(), locale: z.enum(["en", "tr"]).optional() });

export const PATCH = route(async (req) => {
  const host = await requireHost();
  const b = await readJson(req, body);
  const [updated] = await db.update(schema.hosts)
    .set({ ...(b.name !== undefined ? { name: b.name || null } : {}), ...(b.locale ? { locale: b.locale } : {}) })
    .where(eq(schema.hosts.id, host.id)).returning();
  return json(payload(updated ?? host));
});

/** Deletes the host account, events they own (with all files) and memberships, and cancels any Stripe subscription immediately. */
export const DELETE = route(async () => {
  const host = await requireHost();
  await deleteAccount(host.id);
  const res = json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
});
