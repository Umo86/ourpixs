import "server-only";
import { BRANDS, CONTACT_EMAIL, MAIN_BRAND, brandBaseUrl, type Brand, type Locale } from "./config";
import { makeT } from "@/i18n/shared";
import { ApiError } from "./http";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** The login code may be shown in the UI only when email is not configured AND the deploy is not production. */
export function previewCodesAllowed(): boolean {
  return process.env.PREVIEW_SHOW_CODE === "1" && !emailConfigured() && process.env.VERCEL_ENV !== "production";
}

/** One sending address for both brands (hello@bizimresimler.com); only the display name follows the brand. */
function fromAddress(brand: Brand): string {
  const v = brand === "bizimresimler" ? process.env.EMAIL_FROM_TR : process.env.EMAIL_FROM_EN;
  return v || `${BRANDS[brand].name} <${CONTACT_EMAIL}>`;
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

export async function sendCohostInvite(to: string, opts: { inviter: string; title: string; locale: Locale; brand: Brand }) {
  const t = makeT(opts.locale, "host");
  const url = `${brandBaseUrl(opts.brand)}/login`;
  const vars = { inviter: opts.inviter, title: opts.title, brand: BRANDS[opts.brand].name };
  const subject = t("email.invite.subject", vars);
  const body = [t("email.invite.body", vars)];
  const html = layout(opts.brand, { heading: t("email.invite.heading", vars), body, cta: { href: url, label: t("email.invite.cta") }, footer: t("email.invite.footer") });
  await send(opts.brand, to, subject, html, `${subject}\n\n${body.join("\n")}\n\n${url}`);
}

export function formatEmailDate(d: Date, locale: Locale) {
  return d.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

/**
 * "Your gallery has ended — download everything": sent once per event (cron, or lazily when the event is touched).
 * Links to the event's download page in the dashboard.
 */
export async function sendGalleryEndedEmail(to: string, opts: { locale: Locale; brand: Brand; title: string; occasionId: string; deleteAfter: Date | null }) {
  const t = makeT(opts.locale, "host");
  const url = `${brandBaseUrl(opts.brand)}/dashboard/${opts.occasionId}/download`;
  const vars = { brand: BRANDS[opts.brand].name, title: opts.title, date: opts.deleteAfter ? formatEmailDate(opts.deleteAfter, opts.locale) : "" };
  const subject = t("email.ended.subject", vars);
  const body = [t("email.ended.body", vars), t(opts.deleteAfter ? "email.ended.body2" : "email.ended.body2NoDate", vars)];
  const html = layout(opts.brand, { heading: t("email.ended.heading", vars), body, cta: { href: url, label: t("email.ended.cta") }, footer: t("email.ended.footer", vars) });
  await send(opts.brand, to, subject, html, `${subject}\n\n${body.join("\n\n")}\n\n${url}`);
}

/** Reminder before an event's files are deleted (30 and 7 days before delete_after). */
export async function sendDeletionReminder(to: string, opts: { locale: Locale; brand: Brand; title: string; occasionId: string; date: Date; days: number }) {
  const t = makeT(opts.locale, "host");
  const url = `${brandBaseUrl(opts.brand)}/dashboard/${opts.occasionId}/download`;
  const vars = { brand: BRANDS[opts.brand].name, title: opts.title, date: formatEmailDate(opts.date, opts.locale), days: opts.days };
  const subject = t("email.deletionSoon.subject", vars);
  const body = [t("email.deletionSoon.body", vars), t("email.deletionSoon.body2", vars)];
  const html = layout(opts.brand, { heading: t("email.deletionSoon.heading", vars), body, cta: { href: url, label: t("email.deletionSoon.cta") }, footer: t("email.ended.footer", vars) });
  await send(opts.brand, to, subject, html, `${subject}\n\n${body.join("\n\n")}\n\n${url}`);
}

/** Internal alert to admins (ADMIN_EMAILS): an event passed the fair-use storage limit. English only. */
export async function sendFairUseAlert(to: string[], opts: { title: string; occasionId: string; ownerEmail: string; gb: number; limitGb: number }) {
  if (!to.length) return;
  const brand = MAIN_BRAND;
  const url = `${brandBaseUrl(brand)}/admin/events/${opts.occasionId}`;
  const t = makeT("en", "admin");
  const vars = { title: opts.title, owner: opts.ownerEmail, gb: opts.gb.toFixed(1), limit: opts.limitGb };
  const subject = t("fairUse.email.subject", vars);
  const body = [t("fairUse.email.body", vars), t("fairUse.email.body2", vars)];
  const html = layout(brand, { heading: t("fairUse.email.heading", vars), body, cta: { href: url, label: t("fairUse.email.cta") }, footer: t("fairUse.email.footer") });
  for (const addr of to) await send(brand, addr, subject, html, `${subject}\n\n${body.join("\n\n")}\n\n${url}`);
}

export async function sendReportEmail(to: string, opts: { title: string; occasionId: string; reason: string; locale: Locale; brand: Brand }) {
  const t = makeT(opts.locale, "host");
  const url = `${brandBaseUrl(opts.brand)}/dashboard/${opts.occasionId}`;
  const subject = t("email.report.subject", { title: opts.title });
  const body = [t("email.report.body", { title: opts.title }), ...(opts.reason ? [t("email.report.reason", { reason: opts.reason })] : [])];
  const html = layout(opts.brand, { heading: t("email.report.heading"), body, cta: { href: url, label: t("email.report.cta") }, footer: t("email.report.footer") });
  await send(opts.brand, to, subject, html, `${subject}\n\n${body.join("\n")}\n\n${url}`);
}

/**
 * Guest "download everything" receipt: the /d/<token> link (valid 30 days). Brand = the event's brand, language = the
 * guest's at checkout. Plain and friendly; the token in the link is the only copy (we store its hash).
 */
export async function sendGuestDownloadEmail(to: string, opts: { locale: Locale; brand: Brand; title: string; url: string; expiresAt: Date }) {
  const t = makeT(opts.locale, "guest");
  const vars = { brand: BRANDS[opts.brand].name, title: opts.title, date: formatEmailDate(opts.expiresAt, opts.locale) };
  const subject = t("email.purchase.subject", vars);
  const body = [t("email.purchase.body", vars), t("email.purchase.body2", vars)];
  const html = layout(opts.brand, { heading: t("email.purchase.heading", vars), body, cta: { href: opts.url, label: t("email.purchase.cta") }, footer: t("email.purchase.footer", vars) });
  await send(opts.brand, to, subject, html, `${subject}\n\n${body.join("\n\n")}\n\n${opts.url}\n\n${t("email.purchase.footer", vars)}`);
}
