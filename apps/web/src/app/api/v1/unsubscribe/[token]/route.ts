import { route, json, clientIp } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { withdrawByToken } from "@/lib/consent";

/**
 * RFC 8058 one-click unsubscribe (the List-Unsubscribe URL of every marketing email; mail clients POST
 * "List-Unsubscribe=One-Click" here). Always answers 200 so tokens can't be probed; unknown tokens do nothing.
 */
export const POST = route<{ token: string }>(async (req, { token }) => {
  await limit(`unsub:ip:${clientIp(req)}`, 60, 3600);
  await withdrawByToken(token, "list_unsubscribe");
  return json({ ok: true });
});
