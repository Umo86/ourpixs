import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireMemberPage } from "@/lib/auth";
import { OCCASIONS } from "@/lib/config";
import { wallUrl } from "@/lib/occasion";
import { formatDate } from "@/lib/client/format";
import { accessForOccasion } from "@/lib/access";
import { Notice } from "@/components/app/Notice";
import { OccasionTabs } from "@/components/host/OccasionTabs";

export const dynamic = "force-dynamic";

export default async function OccasionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await requireMemberPage(id);
  if (!m) notFound();
  const { t, locale } = await getT("host");
  const o = m.occasion;
  const access = await accessForOccasion(o);
  const eyebrow = [OCCASIONS[o.type].label[locale], o.startsOn ? formatDate(o.startsOn, locale) : null].filter(Boolean).join(" · ");
  const tabs = [
    { href: `/dashboard/${o.id}`, label: t("tabs.album"), exact: true },
    { href: `/dashboard/${o.id}/qr`, label: t("tabs.qr") },
    { href: `/dashboard/${o.id}/missions`, label: t("tabs.missions") },
    { href: `/dashboard/${o.id}/guestbook`, label: t("tabs.guestbook") },
    { href: `/dashboard/${o.id}/download`, label: t("tabs.download") },
    { href: `/dashboard/${o.id}/settings`, label: t("tabs.settings") },
  ];
  const wall = { href: wallUrl(o), label: t("tabs.wall") };
  const date = formatDate(access.deleteAfter?.toISOString(), locale);
  const readOnlyText = access.readOnly
    ? (access.deleted ? t("occasion.archived")
      : t(access.reason === "trial_ended" ? "billing.readOnly.trialEnded" : "billing.readOnly.cancelled", { date }))
    : null;
  return (
    <>
      <Container className="flex flex-col gap-5 pt-4 print:hidden sm:pt-6">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-royal">{eyebrow}</span>
          <h1 className="m-0 text-[clamp(2.2rem,6vw,4.25rem)] font-black leading-[0.92] tracking-[-0.04em]">{o.title}</h1>
          {o.status === "archived" ? <p className="m-0 text-sm font-semibold text-[#8A1C1C]">{t("occasion.archived")}</p> : null}
          {o.status !== "archived" && readOnlyText ? <Notice className="mt-2">{readOnlyText}{m.role === "cohost" ? ` ${t("billing.readOnly.cohost")}` : ""}</Notice> : null}
        </div>
        <OccasionTabs tabs={tabs} wall={wall} label={t("tabs.label")} />
      </Container>
      {children}
    </>
  );
}
