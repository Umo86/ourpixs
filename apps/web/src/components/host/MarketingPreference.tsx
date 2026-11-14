"use client";
import { useState } from "react";
import { Toggle } from "@/components/app/Toggle";
import { Notice } from "@/components/app/Notice";
import { useLocale, useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";
import { BRANDS } from "@/lib/config";

/** "Send me offers and news" on the dashboard: opt-in (off by default), withdrawable any time. */
export function MarketingPreference({ initial }: { initial: boolean }) {
  const t = useT("host");
  const { locale, brand } = useLocale();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change(v: boolean) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ consented: boolean }>("/api/v1/me/marketing", { method: "PUT", body: { consented: v, locale } });
      setOn(r.consented);
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <Toggle checked={on} onChange={change} disabled={busy} label={t("marketing.optIn", { brand: BRANDS[brand].name })} description={t("marketing.optInHint")} />
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
