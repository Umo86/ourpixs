"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui";
import { Notice } from "@/components/app/Notice";
import { useT } from "@/i18n/client";
import { formatGBP } from "@/components/marketing/format";
import { useAdminRequest } from "./AdminAction";
import { Card } from "./ui";

export type SettingField = {
  key: string; label: string; hint: string; unit: "pence" | "days" | "gb" | "seconds" | "months" | "items";
  min: number; max: number; value: number; defaultValue: number; changed: string;
};

const inputCls = "min-h-12 w-full rounded-2xl border-[1.5px] border-[#D5D8E2] bg-white px-4 py-3 text-base text-ink outline-none focus-visible:border-sky focus-visible:ring-2 focus-visible:ring-sky";

/** Prices are typed in pounds (69.00) and stored in pence; everything else is a whole number. */
const toInput = (f: SettingField, v: number) => (f.unit === "pence" ? (v / 100).toFixed(2) : String(v));
const fromInput = (f: SettingField, s: string) => (f.unit === "pence" ? Math.round(Number(s) * 100) : Math.round(Number(s)));

export function SettingsForm({ fields }: { fields: SettingField[] }) {
  const t = useT("admin");
  const base = useId();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, toInput(f, f.value)])));
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const { run, busy, error, setError } = useAdminRequest();

  const parsed = fields.map((f) => ({ f, v: fromInput(f, values[f.key] ?? "") }));
  const invalid = parsed.filter(({ f, v }) => !Number.isFinite(v) || v < f.min || v > f.max);
  const changes = parsed.filter(({ f, v }) => Number.isFinite(v) && v !== f.value);
  const unitLabel = (f: SettingField) => t(`settings.units.${f.unit}`);
  const shown = (f: SettingField, v: number) => (f.unit === "pence" ? formatGBP(v) : `${v} ${unitLabel(f)}`);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    if (invalid.length) { setError(t("settings.invalid")); return; }
    if (!changes.length) { setError(t("settings.noChanges")); return; }
    const ok = await run("/api/admin/settings", "PATCH", { values: Object.fromEntries(changes.map(({ f, v }) => [f.key, v])), reason: reason.trim() });
    if (ok) { setReason(""); setDone(true); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {fields.map((f, i) => {
          const id = `${base}-${i}`;
          const bad = invalid.some((x) => x.f.key === f.key);
          return (
            <Card key={f.key}>
              <div className="flex flex-col gap-2">
                <label htmlFor={id} className="text-[15px] font-black">{f.label}</label>
                <p className="m-0 text-[13px] text-text-2">{f.hint}</p>
                <div className="flex items-center gap-3">
                  {f.unit === "pence" ? <span aria-hidden className="text-lg font-black">£</span> : null}
                  <input id={id} inputMode={f.unit === "pence" ? "decimal" : "numeric"} required aria-invalid={bad || undefined}
                    value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className={inputCls} />
                  {f.unit !== "pence" ? <span className="whitespace-nowrap text-[13px] font-semibold text-muted">{unitLabel(f)}</span> : null}
                </div>
                <span className={`text-xs ${bad ? "font-bold text-[#8A1C1C]" : "text-muted"}`}>
                  {t("settings.range", { min: shown(f, f.min), max: shown(f, f.max) })} · {t("settings.default", { v: shown(f, f.defaultValue) })}
                </span>
                <span className="text-xs text-muted">{f.changed}</span>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="flex max-w-2xl flex-col gap-2">
        <label htmlFor={`${base}-reason`} className="text-[13px] font-semibold text-text-2">{t("common.reason")}</label>
        <textarea id={`${base}-reason`} required minLength={3} maxLength={500} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} resize-y`} />
        <span className="text-xs text-muted">{t("settings.reasonHint")}</span>
      </div>
      {changes.length ? <p className="m-0 text-sm font-semibold text-royal">{t("settings.pending", { n: changes.length })}</p> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {done ? <Notice tone="success">{t("settings.saved")}</Notice> : null}
      <Button type="submit" className="self-start" disabled={busy || reason.trim().length < 3}>{busy ? t("common.working") : t("settings.save")}</Button>
    </form>
  );
}
