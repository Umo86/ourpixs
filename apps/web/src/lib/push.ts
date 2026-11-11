import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { consume } from "./rate-limit";

type Push = { title: string; body: string; data: Record<string, string> };

/** Host ids (owner + co-hosts) of an occasion. */
async function hostIdsFor(occasionId: string) {
  const rows = await db.select({ id: schema.occasionMembers.hostId }).from(schema.occasionMembers).where(eq(schema.occasionMembers.occasionId, occasionId));
  return rows.map((r) => r.id);
}

/** Sends via the Expo push API in batches of 100. Invalid tokens are pruned. Never throws. */
export async function pushToHosts(hostIds: string[], msg: Push) {
  try {
    if (!hostIds.length) return;
    const tokens = await db.select().from(schema.pushTokens).where(inArray(schema.pushTokens.hostId, hostIds));
    if (!tokens.length) return;
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", Accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch.map((t) => ({ to: t.token, title: msg.title, body: msg.body, data: msg.data, sound: "default" }))),
      });
      if (!res.ok) continue;
      const out = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
      const dead = (out?.data || []).map((r, j) => (r.details?.error === "DeviceNotRegistered" ? batch[j]?.token : null)).filter((x): x is string => !!x);
      if (dead.length) await db.delete(schema.pushTokens).where(inArray(schema.pushTokens.token, dead));
    }
  } catch (e) {
    console.error("[push] failed", e);
  }
}

/**
 * Event pushes to an occasion's hosts, rate-limited per occasion+kind so a busy wedding doesn't spam phones.
 * kinds: first_upload (once per day), message (≤3 / 10 min), pending (≤1 / 30 min)
 */
export async function notifyHosts(o: { id: string; title: string; brand: string }, kind: "first_upload" | "message" | "pending", locale: "en" | "tr" = "en") {
  const tr = locale === "tr" || o.brand === "bizimresimler";
  if (kind === "first_upload") {
    const day = new Date().toISOString().slice(0, 10);
    const ins = await db.insert(schema.rateLimits).values({ key: `mark:push:first:${o.id}:${day}`, tokens: 0 }).onConflictDoNothing().returning();
    if (!ins.length) return;
  } else {
    const ok = await consume(`push:${kind}:${o.id}`, kind === "message" ? 3 : 1, kind === "message" ? 600 : 1800);
    if (!ok.allowed) return;
  }
  const copy = {
    first_upload: tr ? { title: "Misafirler yüklüyor!", body: `${o.title} albümüne ilk kareler geldi.` } : { title: "Guests are uploading!", body: `The first shots just landed in ${o.title}.` },
    message: tr ? { title: "Yeni anı mesajı", body: `${o.title} için yeni bir mesaj var.` } : { title: "New guestbook message", body: `Someone left a message for ${o.title}.` },
    pending: tr ? { title: "Onay bekleyen kareler", body: `${o.title} albümünde onayınızı bekleyen kareler var.` } : { title: "Shots waiting for approval", body: `New shots in ${o.title} are waiting for your approval.` },
  }[kind];
  await pushToHosts(await hostIdsFor(o.id), { ...copy, data: { occasionId: o.id, kind } });
}

export { hostIdsFor };
