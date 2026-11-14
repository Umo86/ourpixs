import type { Metadata } from "next";
import Link from "next/link";
import { MEDIA } from "@/components/marketing/constants";
import { Plus } from "lucide-react";
import { Button, Container, Sticker } from "@/components/ui";
import { getT } from "@/i18n";
import { requireHostPage } from "@/lib/auth";
import { summariesFor } from "@/lib/occasion-service";
import { OCCASIONS } from "@/lib/config";
import { formatDate, formatNumber } from "@/lib/client/format";
import { coverFallback } from "@/components/host/occasion-art";
import { DeleteAccountButton } from "@/components/host/DeleteAccountButton";
import { formatInZone } from "@/lib/tz";
import type { OccasionSummary } from "@/lib/api-types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("dashboard.metaTitle") };
}

/** Event card status: Setup / Paid · opens … / Live until … / Ended · download until … (dates in the event's zone). */
function statusOf(o: OccasionSummary, t: (k: string, v?: Record<string, string | number>) => string, locale: "en" | "tr") {
  const d = (iso: string | null) => (iso ? formatInZone(iso, o.timeZone, locale, { year: false }) : "");
  if (o.access.reason === "suspended") return { label: t("dashboard.status.suspended"), tone: "red" as const };
  if (o.access.reason === "locked") return { label: t("dashboard.status.locked"), tone: "red" as const };
  switch (o.packageStatus) {
    case "setup": return { label: t("dashboard.status.setup"), tone: "amber" as const };
    case "paid": return { label: o.opensAt ? t("dashboard.status.paid", { date: d(o.opensAt) }) : t("dashboard.status.paidNoDate"), tone: "blue" as const };
    case "live": return { label: t("dashboard.status.live", { date: d(o.closesAt) }), tone: "green" as const };
    case "ended": return { label: o.deleteAfter ? t("dashboard.status.ended", { date: d(o.deleteAfter) }) : t("dashboard.status.endedNoDate"), tone: "ink" as const };
    case "refunded": return { label: t("dashboard.status.refunded"), tone: "grey" as const };
    default: return { label: t("dashboard.status.expired"), tone: "grey" as const };
  }
}
const TONE = {
  amber: "bg-[#FFF3D6] text-[#7A4B00]", blue: "bg-royal text-white", green: "bg-[#E8F6EE] text-[#165C33]",
  ink: "bg-white text-ink", grey: "bg-black/60 text-white", red: "bg-[#FDECEC] text-[#8A1C1C]",
} as const;

export default async function DashboardPage() {
  const host = await requireHostPage("/dashboard");
  const { t, locale } = await getT("host");
  const list = await summariesFor(host.id);

  return (
    <Container className="flex flex-col gap-10 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-royal">{t("dashboard.eyebrow")}</span>
          <h1 className="m-0 text-[clamp(2.6rem,7vw,5rem)] font-black leading-[0.9] tracking-[-0.04em]">
            {t("dashboard.title")} <span className="font-serif text-royal">{t("dashboard.titleAccent")}</span>
          </h1>
        </div>
        <Button href="/dashboard/new" size="lg"><Plus size={20} aria-hidden />{t("dashboard.new")}</Button>
      </div>

      {list.length === 0 ? (
        <div className="grid gap-8 overflow-hidden rounded-[32px] bg-ink text-white md:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MEDIA.family} alt="" className="h-64 w-full object-cover md:h-full" />
          <div className="flex flex-col items-start gap-5 p-8 sm:p-12">
            <Sticker rotate={-4}>{t("dashboard.emptySticker")}</Sticker>
            <h2 className="m-0 text-4xl font-black leading-none tracking-[-0.03em]">{t("dashboard.emptyTitle")} <span className="font-serif text-sky-soft">{t("dashboard.emptyAccent")}</span></h2>
            <p className="m-0 text-lg text-muted-dark">{t("dashboard.emptyBody")}</p>
            <Button href="/dashboard/new" size="lg" variant="light">{t("dashboard.emptyCta")}</Button>
          </div>
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((o) => {
            const st = statusOf(o, t, locale);
            return (
            <li key={o.id}>
              <Link href={`/dashboard/${o.id}`} className="group relative block aspect-[4/5] overflow-hidden rounded-[28px] bg-surface text-white no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.coverUrl || coverFallback(o.type)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink">{OCCASIONS[o.type].label[locale]}</span>
                  {o.role === "cohost" ? <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold">{t("dashboard.cohost")}</span> : null}
                </div>
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5">
                  <span className={`self-start rounded-full px-3 py-1.5 text-xs font-bold ${TONE[st.tone]}`}><span className="sr-only">{t("dashboard.statusLabel")}: </span>{st.label}</span>
                  <h2 className="m-0 text-[clamp(1.8rem,4vw,2.4rem)] font-black leading-[0.95] tracking-[-0.03em]">{o.title}</h2>
                  <span className="text-sm text-muted-dark">
                    {[o.startsOn ? formatDate(o.startsOn, locale) : null, t("dashboard.counts", { media: formatNumber(o.mediaCount, locale), guests: formatNumber(o.guestCount, locale) })].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="acct-h" className="mt-6 grid gap-4 border-t border-[#E6E8EF] pt-8 md:grid-cols-2">
        <div className="flex flex-col items-start gap-3 rounded-[28px] border border-[#E6E8EF] p-6">
          <h2 id="acct-h" className="m-0 text-xl font-black">{t("dashboard.accountTitle")}</h2>
          <p className="m-0 text-sm text-text-2">{t("dashboard.accountBody", { email: host.email })}</p>
          <DeleteAccountButton />
        </div>
      </section>
    </Container>
  );
}
