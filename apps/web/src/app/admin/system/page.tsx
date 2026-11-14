import { CheckCircle2, CircleAlert, CircleMinus } from "lucide-react";
import { getT } from "@/i18n";
import { requireAdmin } from "@/lib/admin";
import { recentCronRuns } from "@/lib/admin-queries";
import { integrationChecks, publicUrls } from "@/lib/admin-system";
import { CRON_JOBS } from "@/lib/cron";
import { formatDateTime } from "@/lib/client/format";
import { Card, Empty, Facts, PageHeader, Pill } from "@/components/admin/ui";
import { CronRunButton } from "@/components/admin/CronRunButton";

export const dynamic = "force-dynamic";

/** Compact cron summary, e.g. "endedEmails 2 · reminders30 0". */
function summaryText(s: unknown): string {
  if (!s || typeof s !== "object") return "";
  return Object.entries(s as Record<string, unknown>).filter(([k]) => k !== "trigger").map(([k, v]) => `${k} ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");
}

/** Non-secret detail line for a check (storage driver, Stripe mode, counts). */
function detailText(key: string, v: string | undefined, t: (k: string, vars?: Record<string, string | number>) => string): string | null {
  if (!v) return null;
  if (key === "storage") return t(`system.storageDriver.${v === "r2" ? "r2" : "blob"}`);
  if (key === "stripe") return t(`system.stripeMode.${v === "live" ? "live" : "test"}`);
  if (key === "android") return t("system.details.android", { v });
  if (key === "admins") return t("system.details.admins", { v });
  return null;
}

export default async function AdminSystemPage() {
  await requireAdmin();
  const { t, locale } = await getT("admin");
  const checks = integrationChecks();
  const urls = publicUrls();
  const runs = await Promise.all(CRON_JOBS.map(async (name) => ({ name, rows: await recentCronRuns(name, 10) })));
  const dt = (d: Date | null) => (d ? formatDateTime(d.toISOString(), locale) : "–");

  return (
    <>
      <PageHeader eyebrow={t("nav.system")} title={t("system.title")} accent={t("system.accent")} />
      <Card title={t("system.integrations")} id="s-int">
        <p className="m-0 text-[13px] text-text-2">{t("system.integrationsLead")}</p>
        <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
          {checks.map((c) => {
            const Icon = c.ok ? CheckCircle2 : c.required ? CircleAlert : CircleMinus;
            const tone = c.warn ? "text-[#7A4B00]" : c.ok ? "text-[#165C33]" : c.required ? "text-[#8A1C1C]" : "text-muted";
            return (
              <li key={c.key} className="flex min-h-14 items-center gap-3 rounded-2xl bg-tint px-4 py-3">
                <Icon size={20} aria-hidden className={`flex-none ${tone}`} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-bold">{t(`system.checks.${c.key}`)}</span>
                  {detailText(c.key, c.detail, t) ? <span className="text-[13px] text-text-2">{detailText(c.key, c.detail, t)}</span> : null}
                </span>
                <Pill tone={c.warn ? "amber" : c.ok ? "green" : c.required ? "red" : "grey"}>
                  {c.key === "previewCode" ? (c.warn ? t("system.on") : t("system.off")) : c.ok ? t("system.configured") : c.required ? t("system.missing") : t("system.notSet")}
                </Pill>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title={t("system.urls")} id="s-urls">
        <Facts rows={[
          { label: "NEXT_PUBLIC_URL_EN", value: urls.en ?? t("system.notSet") },
          { label: "NEXT_PUBLIC_URL_TR", value: urls.tr ?? t("system.notSet") },
          { label: t("system.environment"), value: urls.env ?? "–" },
        ]} />
      </Card>

      {runs.map(({ name, rows }) => (
        <Card key={name} title={t(`system.cron.${name}`)} id={`s-cron-${name}`} actions={<CronRunButton name={name} label={t(`system.cron.${name}`)} />}>
          <p className="m-0 text-[13px] text-text-2">{t(`system.cronLead.${name}`)}</p>
          {rows.length === 0 ? <Empty>{t("system.noRuns")}</Empty> : (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {rows.map((r) => {
                const trigger = (r.summary as { trigger?: string } | null)?.trigger;
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-tint px-4 py-3 text-[13px]">
                    <Pill tone={r.ok === null ? "amber" : r.ok ? "green" : "red"}>{r.ok === null ? t("system.runningState") : r.ok ? t("system.ok") : t("system.failed")}</Pill>
                    <time dateTime={r.startedAt.toISOString()} className="font-semibold">{dt(r.startedAt)}</time>
                    {r.finishedAt ? <span className="text-muted">{t("system.took", { s: Math.max(0, Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)) })}</span> : null}
                    {trigger ? <span className="text-muted">{t(`system.trigger.${trigger === "admin" ? "admin" : "schedule"}`)}</span> : null}
                    <span className="w-full break-words text-text-2">{summaryText(r.summary)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      ))}
    </>
  );
}
