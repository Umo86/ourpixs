import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireMemberPage } from "@/lib/auth";
import { OCCASIONS, PLANS } from "@/lib/config";
import { planOf, wallUrl } from "@/lib/occasion";
import { formatDate } from "@/lib/client/format";
import { OccasionTabs } from "@/components/host/OccasionTabs";

export const dynamic = "force-dynamic";

export default async function OccasionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await requireMemberPage(id);
  if (!m) notFound();
  const { t, locale } = await getT("host");
  const o = m.occasion;
  const eyebrow = [OCCASIONS[o.type].label[locale], o.startsOn ? formatDate(o.startsOn, locale) : null, PLANS[o.plan].name[locale]].filter(Boolean).join(" · ");
  const tabs = [
    { href: `/dashboard/${o.id}`, label: t("tabs.album"), exact: true },
    { href: `/dashboard/${o.id}/qr`, label: t("tabs.qr") },
    { href: `/dashboard/${o.id}/missions`, label: t("tabs.missions") },
    { href: `/dashboard/${o.id}/guestbook`, label: t("tabs.guestbook") },
    { href: `/dashboard/${o.id}/download`, label: t("tabs.download") },
    { href: `/dashboard/${o.id}/settings`, label: t("tabs.settings") },
  ];
  const wall = planOf(o).liveWall ? { href: wallUrl(o), label: t("tabs.wall") } : { href: `/dashboard/${o.id}/settings#plan`, label: t("tabs.wall"), locked: true };
  return (
    <>
      <Container className="flex flex-col gap-5 pt-4 print:hidden sm:pt-6">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-royal">{eyebrow}</span>
          <h1 className="m-0 text-[clamp(2.2rem,6vw,4.25rem)] font-black leading-[0.92] tracking-[-0.04em]">{o.title}</h1>
          {o.status === "archived" ? <p className="m-0 text-sm font-semibold text-[#8A1C1C]">{t("occasion.archived")}</p> : null}
        </div>
        <OccasionTabs tabs={tabs} wall={wall} label={t("tabs.label")} lockedLabel={t("tabs.locked")} />
      </Container>
      {children}
    </>
  );
}
