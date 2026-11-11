import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireHostPage } from "@/lib/auth";
import { orgsForHost } from "@/lib/org";
import { orgOccasionSummaries, orgPayload } from "@/lib/org-service";
import { paymentsEnabled } from "@/lib/stripe";
import { PARTNER_PENCE } from "@/lib/config";
import { PartnerClient } from "@/components/host/PartnerClient";
import { Notice } from "@/components/app/Notice";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("partner.metaTitle") };
}

export default async function PartnerPage({ searchParams }: { searchParams: Promise<{ org?: string; subscribed?: string; cancelled?: string }> }) {
  const host = await requireHostPage("/dashboard/partner");
  const sp = await searchParams;
  const { t } = await getT("host");
  const rows = await orgsForHost(host.id);
  const current = rows.find((r) => r.org.id === sp.org) ?? rows[0] ?? null;
  const org = current ? await orgPayload(current.org, current.role) : null;
  const occasions = current ? await orgOccasionSummaries(current.org.id) : [];
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-royal">{t("partner.eyebrow")}</span>
        <h1 className="m-0 text-[clamp(2.4rem,6vw,4.25rem)] font-black leading-[0.92] tracking-[-0.04em]">{org ? org.name : t("partner.title")} <span className="font-serif text-royal">{org ? "" : t("partner.titleAccent")}</span></h1>
      </div>
      {sp.subscribed ? <Notice tone="success">{t("partner.subscribedNotice")}</Notice> : null}
      {sp.cancelled ? <Notice>{t("plan.cancelledNotice")}</Notice> : null}
      <PartnerClient
        org={org}
        orgs={rows.map((r) => ({ id: r.org.id, name: r.org.name }))}
        occasions={occasions}
        payments={paymentsEnabled() && !!process.env.STRIPE_PRICE_PARTNER}
        pricePence={PARTNER_PENCE}
      />
    </Container>
  );
}
