"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, QrCode, X } from "lucide-react";
import { ShareButtons } from "@/components/app/ShareButtons";
import { Button, Sticker } from "@/components/ui";
import { Field } from "@/components/app/Field";
import { Notice } from "@/components/app/Notice";
import { useLocale, useT } from "@/i18n/client";
import { OCCASIONS, PLANS, THEMES, type OccasionType } from "@/lib/config";
import { COUPLE_TYPES, suggestTitle } from "@/lib/title";
import { api, errorMessage } from "@/lib/client/api";
import type { Occasion, Theme } from "@/lib/api-types";
import { OCCASION_ART } from "./occasion-art";

const TYPES = Object.keys(OCCASIONS) as OccasionType[];
const THEME_KEYS = Object.keys(THEMES) as Theme[];
type DayDraft = { name: string; offset: number; on: boolean };

function shift(date: string, days: number) {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Wedding-style multi-day defaults: the main day is the one matching the type label; others sit around it. */
function defaultDays(type: OccasionType, locale: "en" | "tr"): DayDraft[] {
  const days = OCCASIONS[type].days;
  if (type === "dugun") return days.map((d, i) => ({ name: d[locale], offset: i === 0 ? -1 : 0, on: i === 1 }));
  return days.map((d, i) => ({ name: d[locale], offset: i, on: i === 0 }));
}

export function NewOccasionWizard({ templateId, initialTheme }: { templateId?: string; initialTheme?: Theme }) {
  const t = useT("host");
  const { locale } = useLocale();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<OccasionType | null>(null);
  const [names, setNames] = useState<string[]>([""]);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [startsOn, setStartsOn] = useState("");
  const [venueName, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [days, setDays] = useState<DayDraft[]>([]);
  const [theme, setTheme] = useState<Theme>(initialTheme ?? "noir");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Occasion | null>(null);

  const autoTitle = useMemo(() => (type ? suggestTitle(type, names, locale) : ""), [type, names, locale]);
  const shownTitle = titleEdited ? title : autoTitle;
  const steps = [t("wizard.stepType"), t("wizard.stepNames"), t("wizard.stepDetails"), t("wizard.stepTheme")];

  function pickType(tp: OccasionType) {
    setType(tp);
    setNames(COUPLE_TYPES.includes(tp) ? ["", ""] : [""]);
    setDays(defaultDays(tp, locale));
    setTitleEdited(false);
    setStep(1);
  }

  async function create() {
    if (!type) return;
    setBusy(true);
    setError(null);
    try {
      const chosen = days.filter((d) => d.on && d.name.trim());
      const r = await api<{ occasion: Occasion }>("/api/v1/occasions", {
        body: {
          type, title: shownTitle.trim() || OCCASIONS[type].label[locale], honorees: names.map((n) => n.trim()).filter(Boolean),
          startsOn: startsOn || null, venueName: venueName || null, city: city || null, theme,
          days: (chosen.length ? chosen : days.slice(0, 1)).map((d) => ({ name: d.name.trim(), date: shift(startsOn, d.offset) })),
        },
      });
      setCreated(r.occasion);
      setStep(4);
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  const heading = (title: string, accent?: string) => (
    <h1 className="m-0 text-[clamp(2.2rem,6vw,3.6rem)] font-black leading-[0.95] tracking-[-0.04em]">
      {title} {accent ? <span className="font-serif text-royal">{accent}</span> : null}
    </h1>
  );

  if (step === 4 && created) {
    return (
      <div className="flex flex-col gap-8">
        <Sticker rotate={-4} className="self-start">{t("wizard.doneSticker")}</Sticker>
        {heading(t("wizard.doneTitle"), t("wizard.doneAccent"))}
        <p className="m-0 max-w-xl text-lg text-text-2">{t("wizard.doneBody")}</p>
        <div className="flex flex-col gap-3 rounded-[28px] bg-tint p-5 sm:flex-row sm:items-center sm:justify-between">
          <code className="break-all text-[15px] font-semibold">{created.guestUrl}</code>
          <ShareButtons url={created.guestUrl} text={t("share.guestMessage", { title: created.title })} title={created.title}
            labels={{ whatsapp: t("share.whatsapp"), share: t("share.native"), copy: t("common.copyLink"), copied: t("common.copied") }} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button href={`/dashboard/${created.id}/qr${templateId ? `?template=${templateId}` : ""}`} size="lg"><QrCode size={20} aria-hidden />{t("wizard.printQr")}</Button>
          <Button href={`/dashboard/${created.id}`} size="lg" variant="secondary">{t("wizard.openAlbum")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label={t("wizard.progress")} className="flex items-center gap-3">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} aria-label={t("common.back")} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">
            <ArrowLeft size={20} aria-hidden />
          </button>
        ) : (
          <Link href="/dashboard" aria-label={t("common.back")} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">
            <ArrowLeft size={20} aria-hidden />
          </Link>
        )}
        <ol className="m-0 flex flex-1 list-none gap-2 p-0">
          {steps.map((s, i) => (
            <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full ${i <= step ? "bg-royal" : "bg-[#E2E4EC]"}`} />
              <span className="sr-only">{s}</span>
            </li>
          ))}
        </ol>
        <span className="text-sm font-semibold text-muted">{t("wizard.stepOf", { n: step + 1, total: steps.length })}</span>
      </nav>

      {step === 0 ? (
        <section className="flex flex-col gap-6">
          {heading(t("wizard.typeTitle"), t("wizard.typeAccent"))}
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
            {TYPES.map((tp) => (
              <li key={tp}>
                <button type="button" onClick={() => pickType(tp)} aria-pressed={type === tp}
                  className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[24px] bg-surface text-left text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={OCCASION_ART[tp]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 p-4 text-xl font-black leading-none tracking-tight">{OCCASIONS[tp].label[locale]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {step === 1 && type ? (
        <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
          {heading(t("wizard.namesTitle"), t("wizard.namesAccent"))}
          <div className="flex flex-col gap-4">
            {names.map((n, i) => (
              <div key={i} className="flex items-end gap-2">
                <Field className="flex-1" id={`name-${i}`} label={t("wizard.nameLabel", { n: i + 1 })} value={n} maxLength={60} autoFocus={i === 0}
                  placeholder={i === 0 ? t("wizard.namePlaceholder1") : t("wizard.namePlaceholder2")}
                  onChange={(e) => setNames((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} />
                {names.length > 1 ? (
                  <button type="button" aria-label={t("wizard.removeName")} onClick={() => setNames((arr) => arr.filter((_, j) => j !== i))}
                    className="mb-0.5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><X size={18} aria-hidden /></button>
                ) : null}
              </div>
            ))}
            {names.length < 4 ? (
              <button type="button" onClick={() => setNames((a) => [...a, ""])} className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">
                <Plus size={18} aria-hidden />{t("wizard.addName")}
              </button>
            ) : null}
            <Field id="title" label={t("wizard.titleLabel")} value={shownTitle} maxLength={120} required hint={t("wizard.titleHint")}
              onChange={(e) => { setTitleEdited(true); setTitle(e.target.value); }} />
          </div>
          <Button type="submit" size="lg" className="self-start" disabled={!shownTitle.trim()}>{t("common.continue")}</Button>
        </form>
      ) : null}

      {step === 2 && type ? (
        <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
          {heading(t("wizard.detailsTitle"), t("wizard.detailsAccent"))}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="date" type="date" label={t("wizard.date")} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            <Field id="city" label={t("wizard.city")} value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} placeholder={t("wizard.cityPlaceholder")} />
            <Field id="venue" className="sm:col-span-2" label={t("wizard.venue")} value={venueName} maxLength={120} onChange={(e) => setVenue(e.target.value)} placeholder={t("wizard.venuePlaceholder")} />
          </div>
          <fieldset className="m-0 flex flex-col gap-3 rounded-[24px] border-0 bg-tint p-5">
            <legend className="float-left mb-1 p-0 text-[15px] font-extrabold">{t("wizard.daysTitle")}</legend>
            <p className="clear-both m-0 text-sm text-muted">{t("wizard.daysHint", { max: PLANS.buyuk.maxDays })}</p>
            {days.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <input type="checkbox" id={`day-${i}`} checked={d.on} onChange={(e) => setDays((arr) => arr.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                  className="h-6 w-6 flex-none accent-royal" aria-label={t("wizard.includeDay", { name: d.name })} />
                <input aria-label={t("wizard.dayName")} value={d.name} maxLength={60} onChange={(e) => setDays((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="min-h-11 flex-1 rounded-xl border-[1.5px] border-[#D5D8E2] bg-white px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky" />
                <span className="w-28 text-right text-sm text-muted">{startsOn ? shift(startsOn, d.offset) : ""}</span>
              </div>
            ))}
            {days.length < PLANS.buyuk.maxDays ? (
              <button type="button" onClick={() => setDays((a) => [...a, { name: t("wizard.newDay", { n: a.length + 1 }), offset: a.length ? a[a.length - 1]!.offset + 1 : 0, on: true }])}
                className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">
                <Plus size={18} aria-hidden />{t("wizard.addDay")}
              </button>
            ) : null}
            {days.filter((d) => d.on).length > PLANS.free.maxDays ? <p className="m-0 text-sm font-semibold text-royal">{t("wizard.multiDayNote")}</p> : null}
          </fieldset>
          <Button type="submit" size="lg" className="self-start">{t("common.continue")}</Button>
        </form>
      ) : null}

      {step === 3 && type ? (
        <section className="flex flex-col gap-6">
          {heading(t("wizard.themeTitle"), t("wizard.themeAccent"))}
          <div role="radiogroup" aria-label={t("wizard.themeTitle")} className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {THEME_KEYS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={theme === k} onClick={() => setTheme(k)}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-[20px] border-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2 ${theme === k ? "border-royal" : "border-[#E2E4EC]"}`}
                style={{ background: THEMES[k].bg, color: THEMES[k].fg }}>
                <span className="font-serif text-2xl" style={{ color: THEMES[k].accent }}>Aa</span>
                {t(`themes.${k}`)}
              </button>
            ))}
          </div>
          <div className="flex min-h-56 flex-col justify-end gap-2 rounded-[32px] p-8" style={{ background: THEMES[theme].bg, color: THEMES[theme].fg }}>
            <span className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: THEMES[theme].accent }}>{OCCASIONS[type].label[locale]}</span>
            <span className="text-[clamp(2rem,6vw,3.4rem)] font-black leading-[0.95] tracking-[-0.03em]">{shownTitle}</span>
          </div>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button size="lg" className="self-start" onClick={create} disabled={busy}>{busy ? t("wizard.creating") : t("wizard.create")}</Button>
        </section>
      ) : null}
    </div>
  );
}
