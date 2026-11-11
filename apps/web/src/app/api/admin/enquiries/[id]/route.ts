import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertUuid, json, notFound, readJson } from "@/lib/http";
import { adminRoute, audit } from "@/lib/admin";

const body = z.object({ action: z.enum(["handled", "reopen"]) });

/** Mark a contact / enquiry (leads table) as handled, or open it again. */
export const POST = adminRoute<{ id: string }>(async (req, { id }, admin) => {
  assertUuid(id, "enquiry");
  const b = await readJson(req, body);
  const [l] = await db.update(schema.leads).set({ handledAt: b.action === "handled" ? new Date() : null })
    .where(eq(schema.leads.id, id)).returning({ id: schema.leads.id, email: schema.leads.email });
  if (!l) throw notFound("Unknown enquiry");
  await audit(admin, `lead.${b.action}`, "lead", id, { email: l.email });
  return json({ ok: true });
});
