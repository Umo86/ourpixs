import "server-only";
import { BRANDS, brandBaseUrl, type Brand, type Locale } from "./config";
import { makeT } from "@/i18n/shared";
import { ApiError } from "./http";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** The login code may be shown in the UI only when email is not configured AND the deploy is not production. */
export function previewCodesAllowed(): boolean {
  return process.env.PREVIEW_SHOW_CODE === "1" && !emailConfigured() && process.env.VERCEL_ENV !== "production";
}

function fromAddress(brand: Brand): string {
  const v = brand === "bizimresimler" ? process.env.EMAIL_FROM_TR : process.env.EMAIL_FROM_EN;
  return v || `${BRANDS[brand].name} <hello@${BRANDS[brand].domain}>`;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal brand-styled HTML email: Bodoni wordmark, big black headline, royal-blue button. */
function layout(brand: Brand, opts: { heading: string; body: string[]; code?: string; cta?: { href: string; label: string }; footer: string }) {
  const name = BRANDS[brand].name;
  const paras = opts.body.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#3A3A3A">${esc(p)}</p>`).join("");
  const code = opts.code
    ? `<div style="margin:22px 0;padding:20px;border-radius:20px;background:#F2F4FB;text-align:center;font-size:40px;font-weight:900;letter-spacing:10px;color:#0A0A0A">${esc(opts.code)}</div>`
    : "";
  const cta = opts.cta
    ? `<p style="margin:24px 0"><a href="${esc(opts.cta.href)}" style="display:inline-block;background:#2347E0;color:#FFFFFF;text-decoration:none;font-weight:800;padding:16px 28px;border-radius:999px">${esc(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#FFFFFF;font-family:'Inter Tight',Helvetica,Arial,sans-serif;color:#0A0A0A">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<div style="font-family:'Bodoni Moda',Didot,Georgia,serif;font-style:italic;font-size:26px;margin-bottom:28px">${esc(name)}<span style="color:#2347E0">.</span></div>
<h1 style="margin:0 0 16px;font-size:30px;line-height:1.05;font-weight:900;letter-spacing:-1px">${esc(opts.heading)}</h1>
${paras}${code}${cta}
<p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#6B6B6B">${esc(opts.footer)}</p>
</div></body></html>`;
}

async function send(brand: Brand, to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new ApiError(503, "email_unavailable", "Email is not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromAddress(brand), to: [to], subject, html, text }),
  });
  if (!res.ok) {
    console.error("[email] resend failed", res.status, await res.text().catch(() => ""));
    throw new ApiError(502, "email_failed", "We couldn't send the email. Please try again.");
  }
}

export async function sendLoginCode(to: string, code: string, locale: Locale, brand: Brand) {
  const t = makeT(locale, "host");
  const name = BRANDS[brand].name;
  const subject = t("email.code.subject", { code, brand: name });
  const body = [t("email.code.body"), t("email.code.expires")];
  const html = layout(brand, { heading: t("email.code.heading"), body, code, footer: t("email.code.ignore") });
  await send(brand, to, subject, html, `${t("email.code.heading")}\n\n${code}\n\n${body.join("\n")}\n\n${t("email.code.ignore")}`);
}

/** `venue` set = partner event: the email is sent in the venue's name (white-label). */
export async function sendCohostInvite(to: string, opts: { inviter: string; title: string; locale: Locale; brand: Brand; venue?: string }) {
  const t = makeT(opts.locale, "host");
  const url = `${brandBaseUrl(opts.brand)}/login`;
  const vars = { inviter: opts.inviter, title: opts.title, brand: opts.venue || BRANDS[opts.brand].name };
  const subject = t("email.invite.subject", vars);
  const body = [t("email.invite.body", vars)];
  const html = layout(opts.brand, { heading: t("email.invite.heading", vars), body, cta: { href: url, label: t("email.invite.cta") }, footer: t("email.invite.footer") });
  await send(opts.brand, to, subject, html, `${subject}\n\n${body.join("\n")}\n\n${url}`);
}

export async function sendExpiryWarning(to: string, opts: { title: string; date: string; occasionId: string; locale: Locale; brand: Brand }) {
  const t = makeT(opts.locale, "host");
  const url = `${brandBaseUrl(opts.brand)}/dashboard/${opts.occasionId}/download`;
  const vars = { title: opts.title, date: opts.date };
  const subject = t("email.expiry.subject", vars);
  const body = [t("email.expiry.body", vars)];
  const html = layout(opts.brand, { heading: t("email.expiry.heading", vars), body, cta: { href: url, label: t("email.expiry.cta") }, footer: t("email.expiry.footer") });
  await send(opts.brand, to, subject, html, `${subject}\n\n${body.join("\n")}\n\n${url}`);
}

export async function sendReportEmail(to: string, opts: { title: string; occasionId: string; reason: string; locale: Locale; brand: Brand }) {
  const t = makeT(opts.locale, "host");
  const url = `${brandBaseUrl(opts.brand)}/dashboard/${opts.occasionId}`;
  const subject = t("email.report.subject", { title: opts.title });
  const body = [t("email.report.body", { title: opts.title }), ...(opts.reason ? [t("email.report.reason", { reason: opts.reason })] : [])];
  const html = layout(opts.brand, { heading: t("email.report.heading"), body, cta: { href: url, label: t("email.report.cta") }, footer: t("email.report.footer") });
  await send(opts.brand, to, subject, html, `${subject}\n\n${body.join("\n")}\n\n${url}`);
}
