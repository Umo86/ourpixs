import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Small server-safe building blocks for /admin, in the host dashboard's light style
 * (tint cards, 24–28px radii, pill controls, Inter Tight black headlines with a Bodoni accent).
 */

export function PageHeader({ eyebrow, title, accent, children }: { eyebrow?: ReactNode; title: ReactNode; accent?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow ? <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-royal">{eyebrow}</span> : null}
        <h1 className="m-0 break-words text-[clamp(2rem,5vw,3.25rem)] font-black leading-[0.95] tracking-[-0.04em]">
          {title}{accent ? <> <span className="font-serif text-royal">{accent}</span></> : null}
        </h1>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
    </div>
  );
}

export function Card({ title, id, children, className = "", actions }: { title?: ReactNode; id?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section aria-labelledby={title && id ? id : undefined} className={`flex min-w-0 flex-col gap-4 rounded-[28px] border border-[#E6E8EF] p-5 sm:p-6 ${className}`}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 id={id} className="m-0 text-xl font-black tracking-tight">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const inner = (
    <>
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd className="m-0 text-[clamp(1.5rem,3.6vw,2.2rem)] font-black leading-none tracking-[-0.03em]">{value}</dd>
      {hint ? <dd className="m-0 text-[13px] text-text-2">{hint}</dd> : null}
    </>
  );
  const cls = "flex flex-col gap-1.5 rounded-[24px] bg-tint px-5 py-4";
  return href ? (
    <Link href={href} className={`${cls} text-ink no-underline transition-colors hover:bg-[#E4E8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky`}>
      <dl className="m-0 flex flex-col gap-1.5">{inner}</dl>
    </Link>
  ) : (
    <dl className={`m-0 ${cls}`}>{inner}</dl>
  );
}

type PillTone = "blue" | "green" | "amber" | "red" | "grey" | "ink";
const PILL: Record<PillTone, string> = {
  blue: "bg-[#E6EBFD] text-[#16309F]",
  green: "bg-[#E8F6EE] text-[#165C33]",
  amber: "bg-[#FFF3D6] text-[#7A4B00]",
  red: "bg-[#FDECEC] text-[#8A1C1C]",
  grey: "bg-tint text-text-2",
  ink: "bg-ink text-white",
};
export function Pill({ tone = "grey", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${PILL[tone]}`}>{children}</span>;
}

export const STATUS_TONE: Record<string, PillTone> = {
  active: "green", trialing: "blue", past_due: "amber", cancelled: "red", expired: "red", none: "grey",
  comped: "ink", suspended: "red", live: "green", readonly: "amber", archived: "grey", locked: "red",
  visible: "green", hidden: "grey", pending: "amber", open: "amber", handled: "green",
};

/** Horizontal-scrolling table wrapper (tables stay real tables on mobile). */
export function TableWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">{children}</table>
    </div>
  );
}
export const th = "sticky top-0 border-b border-[#E6E8EF] bg-white px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-muted first:pl-0";
export const td = "border-b border-[#F0F1F5] px-3 py-3 align-top first:pl-0";
export const linkCls = "font-bold text-royal underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky rounded";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-[24px] bg-tint px-5 py-8 text-center text-[15px] text-text-2">{children}</p>;
}

/** Previous / next links that keep the other query params. */
export function Pagination({ path, params, page, hasNext, param = "page", labels }: {
  path: string; params: Record<string, string>; page: number; hasNext: boolean; param?: string;
  labels: { previous: string; next: string; page: string; nav: string };
}) {
  if (page <= 1 && !hasNext) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== param));
    if (p > 1) q.set(param, String(p));
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  const btn = "inline-flex min-h-11 items-center rounded-full border-[1.5px] border-ink px-5 text-[14px] font-bold text-ink no-underline hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";
  const off = "inline-flex min-h-11 items-center rounded-full border-[1.5px] border-[#D5D8E2] px-5 text-[14px] font-bold text-muted";
  return (
    <nav aria-label={labels.nav} className="flex items-center justify-between gap-3">
      {page > 1 ? <Link href={href(page - 1)} className={btn} rel="prev">{labels.previous}</Link> : <span className={off} aria-hidden>{labels.previous}</span>}
      <span className="text-sm font-semibold text-text-2">{labels.page}</span>
      {hasNext ? <Link href={href(page + 1)} className={btn} rel="next">{labels.next}</Link> : <span className={off} aria-hidden>{labels.next}</span>}
    </nav>
  );
}

const inputCls = "min-h-11 w-full rounded-full border-[1.5px] border-[#D5D8E2] bg-white px-4 text-[15px] text-ink outline-none focus-visible:border-sky focus-visible:ring-2 focus-visible:ring-sky";

/** GET filter form: a search box and optional selects. Works without JavaScript. */
export function FilterBar({ path, q, searchLabel, searchPlaceholder, selects = [], labels, hidden }: {
  path: string; q?: string; searchLabel?: string; searchPlaceholder?: string; hidden?: Record<string, string>;
  selects?: { name: string; label: string; value: string; options: { value: string; label: string }[] }[];
  labels: { apply: string; clear: string };
}) {
  return (
    <form method="get" action={path} className="flex flex-wrap items-end gap-3 rounded-[24px] bg-tint p-4">
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {searchLabel ? (
        <label className="flex min-w-[220px] flex-[2] flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-text-2">{searchLabel}</span>
          <input type="search" name="q" defaultValue={q} placeholder={searchPlaceholder} maxLength={200} className={inputCls} />
        </label>
      ) : null}
      {selects.map((s) => (
        <label key={s.name} className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-text-2">{s.label}</span>
          <select name={s.name} defaultValue={s.value} className={`${inputCls} appearance-auto`}>
            {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      ))}
      <div className="flex gap-2">
        <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-royal px-6 text-[15px] font-bold text-white hover:bg-royal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2">{labels.apply}</button>
        <Link href={path} className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-bold text-text-2 no-underline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">{labels.clear}</Link>
      </div>
    </form>
  );
}

/** Label / value rows. */
export function Facts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_minmax(0,1fr)]">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-[13px] font-semibold text-muted">{r.label}</dt>
          <dd className="m-0 break-words text-[15px]">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Tiny inline-SVG bar chart (no chart library). The accessible summary lives in `label`;
 * each bar has a <title> for hover.
 */
export function Bars({ values, labels, label, height = 64 }: { values: number[]; labels: string[]; label: string; height?: number }) {
  const max = Math.max(1, ...values);
  const w = 8;
  const gap = 3;
  const width = values.length * (w + gap) - gap;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label} className="block h-16 w-full">
      {values.map((v, i) => {
        const h = v === 0 ? 1.5 : Math.max(3, (v / max) * (height - 2));
        return (
          <rect key={i} x={i * (w + gap)} y={height - h} width={w} height={h} rx={2} fill={v === 0 ? "#D5D8E2" : i === values.length - 1 ? "#2347E0" : "#4D6BFF"}>
            <title>{`${labels[i]}: ${v}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
