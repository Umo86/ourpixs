import { NextResponse, type NextRequest } from "next/server";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Guest-Token,X-Occasion-Pin",
  "Access-Control-Max-Age": "86400",
};

/**
 * Tiny on purpose:
 *  - CORS for the mobile JSON API (Bearer/X-Guest-Token auth, never cookies cross-site).
 *  - /dashboard without a session cookie → /login (real verification happens server-side).
 *  - Guest/share pages: first visit picks the language from the phone (Accept-Language) and pins it in the `lang` cookie.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/v1/")) {
    if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: CORS });
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }

  if (pathname.startsWith("/dashboard")) {
    if (!req.cookies.get("op_session")?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if ((pathname.startsWith("/g/") || pathname.startsWith("/s/")) && !req.cookies.get("lang")) {
    const al = req.headers.get("accept-language") || "";
    if (!al) return NextResponse.next();
    const lang = /^tr\b|,\s*tr\b/i.test(al) ? "tr" : "en";
    req.cookies.set("lang", lang);
    const res = NextResponse.next({ request: { headers: req.headers } });
    res.cookies.set("lang", lang, { path: "/", maxAge: 31536000, sameSite: "lax" });
    return res;
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/v1/:path*", "/dashboard/:path*", "/g/:path*", "/s/:path*"] };
