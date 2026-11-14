import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/http";
import { consume } from "@/lib/rate-limit";
import { withdrawByToken } from "@/lib/consent";

const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;

/** Back to the unsubscribe page on the same host (303: the browser follows with a GET). */
function back(req: NextRequest, token: string, query = "") {
  const path = TOKEN_RE.test(token) ? `/unsubscribe/${token}${query}` : "/";
  return NextResponse.redirect(new URL(path, req.url), { status: 303, headers: { "Cache-Control": "no-store" } });
}

/**
 * The "Unsubscribe" button on /unsubscribe/<token> posts here (a plain HTML form, so it works without JavaScript).
 * Only this POST — and the mail apps' RFC 8058 one-click POST to /api/v1/unsubscribe/<token> — withdraws consent;
 * opening the link (GET) never does, because mail scanners and link previews fetch links before the person does.
 * Unknown tokens do nothing and land on the same neutral page.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const r = await consume(`unsub:ip:${clientIp(req)}`, 60, 3600);
    if (!r.allowed) return back(req, token, "?slow=1");
    await withdrawByToken(token, "unsubscribe_link");
  } catch (e) {
    console.error("[unsubscribe] failed", e);
    return back(req, token);
  }
  return back(req, token);
}

/** Opening this address directly does nothing: back to the page with the button. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return back(req, token);
}
