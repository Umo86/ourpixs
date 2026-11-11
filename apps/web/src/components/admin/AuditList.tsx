import type { Locale } from "@/lib/config";
import { formatDateTime } from "@/lib/client/format";
import type { schema } from "@/db";
import { Empty } from "./ui";

type Row = typeof schema.adminAudit.$inferSelect;
type T = (k: string, v?: Record<string, string | number>) => string;

/** Short, readable summary of an audit row's details (reason first; never secrets — none are stored). */
function summary(d: unknown, t: T): string {
  if (!d || typeof d !== "object") return "";
  const o = d as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined || v === "") continue;
    if (k === "ids" && Array.isArray(v)) { parts.push(t("audit.items", { n: v.length })); continue; }
    if (k === "occasionIds" || k === "summary") continue;
    parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return parts.join(" · ");
}

export function AuditList({ rows, t, locale, showTarget = false }: { rows: Row[]; t: T; locale: Locale; showTarget?: boolean }) {
  if (!rows.length) return <Empty>{t("audit.empty")}</Empty>;
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-1 rounded-2xl bg-tint px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <code className="rounded-md bg-white px-2 py-0.5 text-[12px] font-bold text-ink">{r.action}</code>
            <span className="text-text-2">{r.adminEmail}</span>
            <time dateTime={r.createdAt.toISOString()} className="text-muted">{formatDateTime(r.createdAt.toISOString(), locale)}</time>
            {showTarget && r.targetId ? <span className="break-all text-muted">{r.targetType}: {r.targetId}</span> : null}
          </div>
          {summary(r.details, t) ? <p className="m-0 break-words text-[13px] text-text-2">{summary(r.details, t)}</p> : null}
        </li>
      ))}
    </ol>
  );
}
