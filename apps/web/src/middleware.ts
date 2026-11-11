import { NextResponse, type NextRequest } from "next/server";
import { localeFromAcceptLanguage, localeParam } from "@/i18n/negotiate";

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
 *  - `?lang=en|tr` on any page (hreflang URLs, links from the app) pins that language in the `lang` cookie.
 *  - Guest/share pages: first visit picks the language from the phone (Accept-Language) and pins it in the `lang` cookie.
 * Caching: every page reads the host header and cookies (brand + language), so Next renders it per request and sends
 * `Cache-Control: private, no-cache, no-store` — no CDN or shared cache can serve one visitor's language to another.
 * (Next 15 overwrites a custom `Vary` on app pages, so we rely on that, not on Vary. Keep pages dynamic.)
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

  if (pathname.startsWith("/api/")) return NextResponse.next();

  const current = req.cookies.get("lang")?.value;
  let pin = localeParam(req.nextUrl.searchParams.get("lang"));
  if (!pin && !current && (pathname.startsWith("/g/") || pathname.startsWith("/s/"))) {
    pin = localeFromAcceptLanguage(req.headers.get("accept-language"));
  }
  if (pin && pin !== current) {
    req.cookies.set("lang", pin);
    const res = NextResponse.next({ request: { headers: req.headers } });
    res.cookies.set("lang", pin, { path: "/", maxAge: 31536000, sameSite: "lax" });
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/v1/:path*",
    // Every page, but not Next internals or static files (images, robots.txt, sitemap.xml, .well-known JSON…).
    "/((?!api/|_next/|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|mp4|webm|txt|xml|json|webmanifest|js|css|map|woff2?)$).*)",
  ],
};
