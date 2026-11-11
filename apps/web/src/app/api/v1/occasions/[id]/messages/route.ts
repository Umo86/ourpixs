import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readQuery } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { messagesWithNames } from "@/lib/queries";
import { toMessages } from "@/lib/serializers";
import { deleteObjects } from "@/lib/storage";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const { occasion } = await requireMember(id);
  return json({ messages: await toMessages(await messagesWithNames(occasion.id)) });
});

/** Additive: DELETE ?messageId= removes a guestbook entry. */
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id);
  const { messageId } = readQuery(req, z.object({ messageId: z.string().uuid() }));
  const scope = and(eq(schema.messages.id, messageId), eq(schema.messages.occasionId, occasion.id));
  const [m] = await db.select().from(schema.messages).where(scope);
  if (m?.mediaKey) await deleteObjects([m.mediaKey]).catch(() => {});
  await db.delete(schema.messages).where(scope);
  return json({ messages: await toMessages(await messagesWithNames(occasion.id)) });
});
