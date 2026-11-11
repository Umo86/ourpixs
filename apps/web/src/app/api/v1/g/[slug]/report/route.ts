import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/db";
import { route, json, readJson, notFound, clientIp } from "@/lib/http";
import { getGuest, occasionBySlug, requirePinAccess } from "@/lib/guest";
import { limit } from "@/lib/rate-limit";
import { emailConfigured, sendReportEmail } from "@/lib/email";
import { notifyHosts } from "@/lib/push";

const body = z.object({ mediaId: z.string().uuid(), reason: z.string().trim().max(500).optional().nullable() });

/** Guest reports a photo: it leaves the feed (approved=false, flag "reported") until a host reviews it. */
export const POST = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await getGuest(o);
  const ip = clientIp(req);
  await requirePinAccess(o, ip, guest);
  await limit(`report:${o.id}:${guest?.id ?? ip}`, 10, 3600);
  // Re-joining mints a new guest id, so also cap per IP: reports hide photos until a host looks.
  await limit(`report:ip:${o.id}:${ip}`, 30, 3600);
  const b = await readJson(req, body);
  const [m] = await db.update(schema.media).set({
    approved: false,
    moderationFlags: sql`case when 'reported' = any(${schema.media.moderationFlags}) then ${schema.media.moderationFlags} else array_append(${schema.media.moderationFlags}, 'reported') end`,
  }).where(and(eq(schema.media.id, b.mediaId), eq(schema.media.occasionId, o.id), eq(schema.media.status, "uploaded"), eq(schema.media.visibility, "visible")))
    .returning({ id: schema.media.id });
  if (!m) throw notFound("Unknown photo");
  after(async () => {
    await notifyHosts(o, "pending");
    if (!emailConfigured()) return;
    const hosts = await db.select({ email: schema.hosts.email, locale: schema.hosts.locale }).from(schema.occasionMembers)
      .innerJoin(schema.hosts, eq(schema.hosts.id, schema.occasionMembers.hostId)).where(eq(schema.occasionMembers.occasionId, o.id));
    for (const h of hosts) {
      await sendReportEmail(h.email, { title: o.title, occasionId: o.id, reason: b.reason || "", locale: h.locale === "tr" ? "tr" : "en", brand: o.brand })
        .catch((e) => console.error("[report] email failed", e));
    }
  });
  return json({ ok: true });
});
