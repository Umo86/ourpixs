/** Only allow same-site relative redirects after login. */
export function safeNext(v: unknown, fallback = "/dashboard"): string {
  // Browsers strip tabs/newlines and treat "\\" as "/", so "/\t/evil.com" would become "//evil.com".
  if (typeof v !== "string" || !v.startsWith("/") || v.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(v)) return fallback;
  return v;
}
