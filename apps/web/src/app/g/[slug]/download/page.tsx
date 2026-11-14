import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n";
import { requireJoined } from "@/lib/guest-guard";
import { getGuest, occasionBySlug } from "@/lib/guest";
import { activePurchase, fulfilGuestPurchase, purchaseItems, purchaseSummary } from "@/lib/guest-purchase";
import { accessForOccasion } from "@/lib/access";
import { toMediaItems } from "@/lib/serializers";
import { paymentsEnabled } from "@/lib/stripe";
import { ScreenHeader } from "@/components/guest/ScreenHeader";
import { PurchaseCard } from "@/components/guest/PurchaseOffer";
import { PurchaseDownloads } from "@/components/guest/PurchaseDownloads";

export const dynamic = "force-dynamic";

/**
 * After Stripe Checkout (…/download?session_id=…) and from the feed: what this device bought with "download everything".
 * The success redirect confirms the payment with Stripe itself (idempotent, same as the webhook), so a slow webhook
 * never leaves the guest waiting.
 */
export default async function GuestDownloadPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const { slug } = await params;
  const { session_id: sessionId } = await searchParams;
  const ctx = await requireJoined(slug);
  if (ctx.demo) notFound();
  const { t } = await getT("guest", { preferBrowser: true });
  const o = await occasionBySlug(slug);
  const guest = await getGuest(o);
  if (!guest) notFound();
  if (typeof sessionId === "string" && /^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId) && paymentsEnabled()) {
    await fulfilGuestPurchase(sessionId).catch((e) => console.error("[guest-download] confirm on return failed", e));
  }
  const [purchase, access] = await Promise.all([activePurchase(o.id, guest.id), accessForOccasion(o)]);
  const path = `/g/${slug}`;

  if (!purchase || !access.canDownload) {
    return (
      <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-5 px-5">
        <ScreenHeader title={t("download.title")} accent={t("download.titleAccent")} close={path} closeLabel={t("common.close")} />
        {sessionId ? (
          <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
            <p className="m-0 text-xl font-black tracking-tight">{t("download.confirming")}</p>
            <p className="m-0 text-muted-dark">{t("download.confirmingBody")}</p>
            <Link href={`${path}/download?session_id=${encodeURIComponent(sessionId)}`} className="inline-flex min-h-12 items-center self-start rounded-full bg-royal px-6 font-extrabold text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">{t("download.refresh")}</Link>
          </div>
        ) : <PurchaseCard />}
      </main>
    );
  }

  const [summary, page] = await Promise.all([purchaseSummary(o), purchaseItems(o, 300)]);
  // Active purchase checked above: clean previews for the buyer on this device.
  const items = await toMediaItems(page.rows, { kind: "guest", guestId: guest.id, purchased: true });
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-5 px-5">
      <ScreenHeader title={t("download.title")} accent={t("download.titleAccent")} sub={o.title} close={path} closeLabel={t("common.close")} />
      {sessionId ? <p role="status" className="m-0 rounded-2xl bg-surface p-4 font-bold">{purchase.email ? t("download.thanksEmail", { email: purchase.email }) : t("download.thanks")}</p> : null}
      <PurchaseDownloads title={o.title} expiresAt={purchase.tokenExpiresAt?.toISOString() ?? null} summary={summary}
        manifestUrl={`/api/v1/g/${slug}/purchase/files`} itemPrefix={`/api/v1/g/${slug}/media/`} itemSuffix="/download"
        items={items} more={!!page.nextCursor} />
    </main>
  );
}
