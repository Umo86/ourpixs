import type { Metadata } from "next";
import { headers } from "next/headers";
import { getT } from "@/i18n";
import { SiteHeader, SiteFooter } from "@/components/site";
import { purchaseFromToken, purchaseItems, purchaseSummary } from "@/lib/guest-purchase";
import { toMediaItems } from "@/lib/serializers";
import { consume } from "@/lib/rate-limit";
import { sha256 } from "@/lib/crypto";
import { PurchaseDownloads } from "@/components/guest/PurchaseDownloads";
import { Title } from "@/components/guest/Title";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * The emailed "download everything" link (valid 30 days). The token is checked by its hash, the purchase must be
 * paid and not refunded, and the event's files must still exist. Every download mints fresh short-lived links.
 */
export default async function TokenDownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getT("guest", { preferBrowser: true });
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
  const [byIp, byToken] = await Promise.all([consume(`dp:ip:${ip}`, 60, 600), consume(`dp:t:${sha256(token).slice(0, 24)}`, 120, 3600)]);
  const r = byIp.allowed && byToken.allowed ? await purchaseFromToken(token) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-white">
      <SiteHeader variant="dark" minimal />
      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 pb-12">
        {!r ? (
          <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
            <h1 className="m-0 text-3xl font-black tracking-[-0.04em]">{!byIp.allowed || !byToken.allowed ? t("download.slowDown") : t("download.invalidTitle")}</h1>
            <p className="m-0 text-muted-dark">{t("download.invalidBody")}</p>
          </div>
        ) : (
          <Body token={token} r={r} title={t("download.title")} accent={t("download.titleAccent")} />
        )}
      </main>
      <SiteFooter compact />
    </div>
  );
}

async function Body({ token, r, title, accent }: { token: string; r: NonNullable<Awaited<ReturnType<typeof purchaseFromToken>>>; title: string; accent: string }) {
  const [summary, page] = await Promise.all([purchaseSummary(r.occasion), purchaseItems(r.occasion, 300)]);
  // The buyer's own link (active purchase checked by purchaseFromToken): clean previews.
  const items = await toMediaItems(page.rows, { kind: "buyer" });
  return (
    <>
      <header className="flex flex-col gap-2 pt-2">
        <h1 className="m-0 text-[34px] font-black leading-none tracking-[-0.05em]">{title} <span className="font-serif font-normal text-sky-soft">{accent}</span></h1>
        <p className="m-0 text-lg font-bold"><Title text={r.occasion.title} /></p>
      </header>
      <PurchaseDownloads title={r.occasion.title} expiresAt={r.purchase.tokenExpiresAt?.toISOString() ?? null} summary={summary}
        manifestUrl={`/api/v1/d/${token}/files`} itemPrefix={`/api/v1/d/${token}/files/`} itemSuffix="" items={items} more={!!page.nextCursor} />
    </>
  );
}
