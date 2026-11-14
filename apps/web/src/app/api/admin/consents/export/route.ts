import { z } from "zod";
import { readQuery } from "@/lib/http";
import { adminRoute, audit } from "@/lib/admin";
import { limit } from "@/lib/rate-limit";
import { exportConsents } from "@/lib/admin-queries";
import { CONSENT_STATUS } from "@/lib/consent";

const query = z.object({
  q: z.string().trim().max(200).optional(),
  brand: z.enum(["bizimresimler", "ourpixs"]).optional(),
  status: z.enum(CONSENT_STATUS).optional(),
});

/** CSV cell: quoted, quotes doubled, and a leading = + - @ neutralised (no formula injection in spreadsheets). */
function cell(v: unknown): string {
  let s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** GET /api/admin/consents/export → text/csv of marketing consents (same filters as the page). Audited, rate-limited. */
export const GET = adminRoute(async (req, _p, admin) => {
  await limit(`admin:export:${admin.id}`, 10, 600);
  const f = readQuery(req, query);
  const rows = await exportConsents({ q: f.q ?? null, brand: f.brand ?? null, status: f.status ?? null });
  const head = ["id", "email", "brand", "locale", "consented", "wording", "source", "occasion_id", "ip_hash", "user_agent", "consented_at", "withdrawn_at", "withdrawn_via"];
  const lines = [head.join(","), ...rows.map((r) => [r.id, r.email, r.brand, r.locale, r.consented, r.wording, r.source, r.occasionId, r.ipHash, r.userAgent, r.consentedAt, r.withdrawnAt, r.withdrawnVia].map(cell).join(","))];
  await audit(admin, "consents.export", "consent", null, { filters: f, rows: rows.length });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="marketing-consents-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
});
