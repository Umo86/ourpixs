import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { SiteHeader, SiteFooter } from "@/components/site";
import { getLocale } from "@/i18n";
import { makeT } from "@/i18n/shared";
import { OCCASIONS } from "@/lib/config";
import { publicSlug, revealedForGuests, shareUrl } from "@/lib/occasion";
import { liveMedia, mediaPage } from "@/lib/queries";
import { coverUrlFor, toMediaItems } from "@/lib/serializers";
import { accessForOccasion } from "@/lib/access";
import { THEMES } from "@/lib/config";
import { formatDate } from "@/lib/client/format";
import { Title } from "@/components/guest/Title";
import { ShareGallery } from "@/components/guest/ShareGallery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SharePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ cursor?: string }> }) {
  const { token } = await params;
  const { cursor } = await searchParams;
  if (!/^[0-9a-zA-Z]{16,64}$/.test(token)) notFound();
  const [row] = await db.select({ link: schema.shareLinks, o: schema.occasions })
    .from(schema.shareLinks).innerJoin(schema.occasions, eq(schema.occasions.id, schema.shareLinks.occasionId))
    .where(and(eq(schema.shareLinks.token, token), or(isNull(schema.shareLinks.expiresAt), gt(schema.shareLinks.expiresAt, new Date())), ne(schema.occasions.status, "archived")))
    .limit(1);
  if (!row) notFound();
  const { link, o } = row;
  const locale = await getLocale();
  const t = makeT(locale, "guest");
  const where = [...liveMedia(o.id), eq(schema.media.visibility, "visible"), eq(schema.media.approved, true), inArray(schema.media.kind, ["photo", "video"]), revealedForGuests(o)];
  // Share links open with the gallery (live or ended), like the guest link; never before it opens or after deletion.
  const access = await accessForOccasion(o);
  if (!access.guestsCanView) notFound();
  const [page, cover] = await Promise.all([
    mediaPage({ where, cursor: typeof cursor === "string" ? cursor : undefined, limit: 60 }).catch(() => ({ rows: [], nextCursor: null })),
    coverUrlFor(o.coverKey),
  ]);
  // Share links are for viewing; downloads follow the event's download access.
  const items = await toMediaItems(page.rows, { kind: "share" });
  const eyebrow = [OCCASIONS[o.type].label[locale], o.startsOn ? formatDate(o.startsOn, locale) : null, o.city].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-white">
      <SiteHeader variant="dark" minimal />
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 pb-12 sm:px-8">
        <section className="relative flex min-h-[38vh] flex-col justify-end overflow-hidden rounded-[32px] p-6 sm:p-10" style={{ background: THEMES[o.theme].bg }}>
          {cover ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
            </>
          ) : null}
          <div className="relative flex flex-col gap-3">
            <span className="self-start rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink">{eyebrow}</span>
            <h1 className="m-0 text-[clamp(2.6rem,9vw,5.5rem)] font-black leading-[0.9] tracking-[-0.045em]"><Title text={o.title} /></h1>
            <p className="m-0 text-muted-dark">{link.label ? t("share.forLabel", { label: link.label }) : t("share.lead")}</p>
          </div>
        </section>
        <div className="flex flex-wrap items-center gap-3">
          {link.scope === "view_upload" && access.guestsCanUpload ? (
            <Link href={`/g/${publicSlug(o)}?k=${token}`} className="inline-flex min-h-12 items-center rounded-full bg-royal px-6 font-extrabold text-white no-underline hover:bg-royal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">{t("share.addYours")}</Link>
          ) : null}
        </div>
        <ShareGallery items={items} shareUrl={shareUrl(o, token)} shareText={t("share.message", { title: o.title })} title={o.title} />
        {page.nextCursor ? (
          <Link href={`?cursor=${page.nextCursor}`} className="inline-flex min-h-12 items-center justify-center self-center rounded-full bg-surface px-6 font-bold text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">{t("share.more")}</Link>
        ) : null}
      </main>
      <SiteFooter compact />
    </div>
  );
}
