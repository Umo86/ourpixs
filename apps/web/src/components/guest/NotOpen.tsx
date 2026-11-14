"use client";
import { CalendarClock } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import { OCCASIONS, THEMES } from "@/lib/config";
import { formatInZone } from "@/lib/tz";
import { useGuest } from "./GuestContext";
import { Title } from "./Title";

/**
 * What guests see before the gallery opens (event not paid yet, or paid and before opensAt),
 * and after it is refunded or deleted. No join form: there's nothing to do here yet.
 */
export function NotOpen() {
  const t = useT("guest");
  const { locale } = useLocale();
  const { occasion: o } = useGuest();
  const c = THEMES[o.theme];
  const unavailable = o.galleryState === "unavailable";
  // A date is only promised when it's in the future (an unpaid event's date can pass before the hosts pay).
  const opens = !unavailable && o.opensAt && new Date(o.opensAt).getTime() > Date.now() ? formatInZone(o.opensAt, o.timeZone, locale, { weekday: true }) : null;
  const title = unavailable ? t("notOpen.unavailableTitle") : opens ? t("notOpen.title") : t("notOpen.soonTitle");
  const body = unavailable ? t("notOpen.unavailableBody") : opens ? t("notOpen.body", { date: opens }) : t("notOpen.soonBody");

  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <div className="relative mx-0 flex min-h-[46dvh] flex-col justify-end overflow-hidden rounded-b-[36px] p-5 sm:mx-5 sm:rounded-[36px]" style={{ background: c.bg, color: o.coverUrl ? "#fff" : c.fg }}>
        {o.coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          </>
        ) : null}
        <div className="relative flex flex-col gap-2">
          <span className="self-start rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink">{OCCASIONS[o.type].label[locale]}</span>
          <h1 className="m-0 text-[clamp(2.8rem,14vw,4rem)] font-black leading-[0.9] tracking-[-0.045em]"><Title text={o.title} accent={o.coverUrl ? "#8097FF" : c.accent} /></h1>
        </div>
      </div>
      <section aria-labelledby="not-open-h" className="flex flex-1 flex-col gap-4 px-5 pb-8 pt-7">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-royal text-white"><CalendarClock size={22} aria-hidden /></span>
        <h2 id="not-open-h" className="m-0 text-[28px] font-black leading-tight tracking-[-0.03em]">{title}</h2>
        <p className="m-0 text-lg leading-relaxed text-muted-dark">{body}</p>
        {!unavailable ? <p className="m-0 text-[15px] text-muted-dark">{t("notOpen.keepLink")}</p> : null}
      </section>
    </main>
  );
}
