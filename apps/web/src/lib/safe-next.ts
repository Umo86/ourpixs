/** Only allow same-site relative redirects after login. */
export function safeNext(v: unknown, fallback = "/dashboard"): string {
  if (typeof v !== "string" || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}
