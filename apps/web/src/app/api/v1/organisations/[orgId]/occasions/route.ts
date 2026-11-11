import { z } from "zod";
import { db, schema } from "@/db";
import { route, json, readJson, ApiError, badRequest } from "@/lib/http";
import { normalizeEmail } from "@/lib/auth";
import { orgActive, requireOrgMember } from "@/lib/org";
import { createOccasion, createSchema, occasionPayload } from "@/lib/occasion-service";
import { orgOccasionSummaries } from "@/lib/org-service";
import { emailConfigured, sendCohostInvite } from "@/lib/email";
import { limit } from "@/lib/rate-limit";
import { requestBrand, requestLocale } from "@/lib/request";
import { eq } from "drizzle-orm";

export const GET = route<{ orgId: string }>(async (_req, { orgId }) => {
  const { org } = await requireOrgMember(orgId);
  return json({ occasions: await orgOccasionSummaries(org.id) });
});

const body = createSchema.extend({
  /** Optional: invite the couple / client as co-host so they can see their album. */
  coupleEmail: z.email().max(200).optional().nullable(),
});

/** Create an event on behalf of a client. Gets the Big Day plan while the subscription is active. */
export const POST = route<{ orgId: string }>(async (req, { orgId }) => {
  const { host, org } = await requireOrgMember(orgId);
  if (!orgActive(org)) throw new ApiError(402, "partner_inactive", "Subscribe to the Partner plan to create events");
  await limit(`org:occ:${org.id}`, 200, 86400);
  const b = await readJson(req, body);
  const o = await createOccasion(host.id, requestBrand(req), b, org);
  if (b.coupleEmail) {
    const email = normalizeEmail(b.coupleEmail);
    if (email === host.email) throw badRequest("Use the couple's email, not yours");
    const [existing] = await db.select().from(schema.hosts).where(eq(schema.hosts.email, email)).limit(1);
    if (existing) await db.insert(schema.occasionMembers).values({ occasionId: o.id, hostId: existing.id, role: "cohost" }).onConflictDoNothing();
    else await db.insert(schema.cohostInvites).values({ occasionId: o.id, email });
    if (emailConfigured()) {
      await sendCohostInvite(email, { inviter: org.name, title: o.title, locale: requestLocale(req), brand: o.brand, venue: org.name })
        .catch((e) => console.error("[partner] couple invite failed", e));
    }
  }
  return json({ occasion: await occasionPayload(o, "owner") }, { status: 201 });
});
