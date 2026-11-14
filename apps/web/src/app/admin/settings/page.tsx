import { getT } from "@/i18n";
import { requireAdmin } from "@/lib/admin";
import { PACKAGE_DEFAULTS } from "@/lib/config";
import { getSettings, SETTING_KEYS, SETTING_RULES, settingsRows } from "@/lib/settings";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import { formatDateTime } from "@/lib/client/format";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm, type SettingField } from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

/** Prices, gallery window, fair use, video length, retention and the test-mode limit (stored in `settings`, defaults in config.ts). */
export default async function AdminSettingsPage() {
  await requireAdmin();
  const { t, locale } = await getT("admin");
  const [current, rows] = await Promise.all([getSettings(), settingsRows().catch(() => [])]);
  const editorIds = [...new Set(rows.map((r) => r.updatedBy).filter((x): x is string => !!x))];
  const editors = editorIds.length
    ? new Map((await db.select({ id: schema.hosts.id, email: schema.hosts.email }).from(schema.hosts).where(inArray(schema.hosts.id, editorIds))).map((h) => [h.id, h.email]))
    : new Map<string, string>();
  const fields: SettingField[] = SETTING_KEYS.map((k) => {
    const row = rows.find((r) => r.key === k);
    return {
      key: k, label: t(`settings.keys.${k}.label`), hint: t(`settings.keys.${k}.hint`), unit: SETTING_RULES[k].unit,
      min: SETTING_RULES[k].min, max: SETTING_RULES[k].max, value: current[k], defaultValue: PACKAGE_DEFAULTS[k],
      changed: row ? t("settings.changedBy", { date: formatDateTime(row.updatedAt.toISOString(), locale), who: (row.updatedBy && editors.get(row.updatedBy)) || "–" }) : t("settings.usingDefault"),
    };
  });
  return (
    <>
      <PageHeader eyebrow={t("nav.settings")} title={t("settings.title")} accent={t("settings.accent")} />
      <p className="m-0 max-w-3xl text-[15px] text-text-2">{t("settings.lead")}</p>
      <SettingsForm fields={fields} />
    </>
  );
}
