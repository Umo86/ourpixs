import { route, json } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/auth";

/** Additive (web only): clears the session cookie. JWTs are stateless; mobile just forgets its token. */
export const POST = route(async () => {
  const res = json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
});
