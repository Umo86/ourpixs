import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApiError, assertUuid, json, notFound, readJson } from "@/lib/http";
import { adminRoute, audit, reasonSchema } from "@/lib/admin";
import { normalizeEmail } from "@/lib/auth";
import { deleteAccount } from "@/lib/account";

export const maxDuration = 60;

/**
 * Account actions: suspend / unsuspend. (The subscription-era actions — extend trial, complimentary access,
 * cancel subscription — are gone: payments are per event now; admins mark single events as paid on /admin/events/:id.)
 */
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), reason: reasonSchema }),
  z.object({ action: z.literal("unsuspend"), reason: reasonSchema }),
]);

/** Admin actions on one account. Every action is validated, rate-limited (adminRoute) and audited. */
export const POST = adminRoute<{ id: string }>(async (req, { id }, admin) => {
  assertUuid(id, "account");
  const b = await readJson(req, body);
  const [h] = await db.select().from(schema.hosts).where(eq(schema.hosts.id, id)).limit(1);
  if (!h) throw notFound("Unknown account");
  const now = new Date();
  const H = schema.hosts;
  let details: Record<string, unknown> = {};

  switch (b.action) {
    case "suspend": {
      if (h.id === admin.id) throw new ApiError(409, "self_action", "You can't suspend your own account");
      await db.update(H).set({ suspendedAt: h.suspendedAt ?? now, suspendedReason: b.reason }).where(eq(H.id, id));
      break;
    }
    case "unsuspend": {
      await db.update(H).set({ suspendedAt: null, suspendedReason: null }).where(eq(H.id, id));
      details = { suspendedSince: h.suspendedAt?.toISOString() ?? null };
      break;
    }
  }
  await audit(admin, `host.${b.action}`, "host", id, { email: h.email, reason: b.reason, ...details });
  return json({ ok: true });
});

const del = z.object({ confirmEmail: z.string().trim().max(320), reason: reasonSchema });

/** Deletes the account the same way the host can (every owned event with its files). */
export const DELETE = adminRoute<{ id: string }>(async (req, { id }, admin) => {
  assertUuid(id, "account");
  const b = await readJson(req, del);
  const [h] = await db.select({ id: schema.hosts.id, email: schema.hosts.email }).from(schema.hosts).where(eq(schema.hosts.id, id)).limit(1);
  if (!h) throw notFound("Unknown account");
  if (h.id === admin.id) throw new ApiError(409, "self_action", "Delete your own account from the dashboard instead");
  if (normalizeEmail(b.confirmEmail) !== normalizeEmail(h.email)) throw new ApiError(400, "confirm_mismatch", "The email doesn't match");
  await deleteAccount(h.id);
  await audit(admin, "host.delete", "host", id, { email: h.email, reason: b.reason });
  return json({ ok: true });
});
