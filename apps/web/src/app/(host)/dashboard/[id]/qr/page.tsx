import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { makeT } from "@/i18n/shared";
import { requireMemberPage } from "@/lib/auth";
import { BRANDS, OCCASIONS, THEMES } from "@/lib/config";
import { TEMPLATES } from "@/content/templates";
import { activeDays, brandLocale, dayGuestUrl, guestUrl } from "@/lib/occasion";
import { loadDays } from "@/lib/queries";
import { coverUrlFor } from "@/lib/serializers";
import { ShareButtons } from "@/components/app/ShareButtons";
import { formatDate } from "@/lib/client/format";
import { PrintButton } from "@/components/host/PrintButton";
import { QrArtwork } from "@/components/host/QrArtwork";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("qr.metaTitle") };
}

const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
.qr-sheet { width: 210mm; height: 297mm; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.qr-sheet.cards { display: grid; grid-template-columns: 105mm 105mm; grid-template-rows: 148.5mm 148.5mm; }
.qr-sheet.cards > div { border: 0.2mm dashed #C8CAD2; }
@media screen { .qr-sheet { box-shadow: 0 20px 60px rgba(10,10,10,.12); border-radius: 6px; overflow: hidden; } }
@media print {
  html, body { background: #fff !important; }
  .qr-screen-wrap { padding: 0 !important; overflow: visible !important; }
  .qr-sheet { box-shadow: none; border-radius: 0; }
}`;

export default async function QrPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ format?: string; day?: string; template?: string }> }) {
  const { id } = await params;
  const m = await requireMemberPage(id);
  if (!m) notFound();
  const o = m.occasion;
  const sp = await searchParams;
  const format = sp.format === "poster" ? "poster" : "cards";
  const { t, locale } = await getT("host");
  const days = activeDays(o, await loadDays(o.id));
  const day = days.length > 1 ? days.find((d) => d.id === sp.day) ?? null : null;
  const url = day ? dayGuestUrl(o, day.id) : guestUrl(o);
  const cover = await coverUrlFor(o.coverKey);
  // The six designs from the marketing /templates page. Default: the one matching the event's theme.
  const template = TEMPLATES.find((x) => x.id === sp.template) ?? TEMPLATES.find((x) => x.theme === o.theme) ?? TEMPLATES[0]!;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 1200, errorCorrectionLevel: "Q", color: { dark: "#0A0A0A", light: "#FFFFFF" } });

  // Card copy is bilingual: the event's own language first, the other underneath.
  const primary = brandLocale(o);
  const secondary = primary === "tr" ? "en" : "tr";
  const p = makeT(primary, "host");
  const s = makeT(secondary, "host");
  const copy = {
    eyebrow: [day ? day.name : OCCASIONS[o.type].label[primary], (day?.date ?? o.startsOn) ? formatDate((day?.date ?? o.startsOn)!, primary) : null,
      o.venueName ? p("qr.atVenue", { venue: o.venueName }) : null].filter(Boolean).join(" · "),
    title: o.title,
    sticker: p("qr.sticker"),
    headline: p("qr.headline"),
    accent: p("qr.accent"),
    body: p("qr.body"),
    secondary: s("qr.body"),
    brand: BRANDS[o.brand].name,
    url: url.replace(/^https?:\/\//, "").replace(/\?d=.*$/, ""),
  };
  const art = {
    qr, copy, cover, logo: null,
    theme: THEMES[template.theme], layout: template.layout,
  };
  const q = (patch: Record<string, string | undefined>) => {
    const v = new URLSearchParams();
    const merged = { format, day: day?.id, template: template.id, ...patch };
    Object.entries(merged).forEach(([k, val]) => val && v.set(k, val));
    return `?${v}`;
  };
  const tab = "inline-flex min-h-11 items-center rounded-full px-5 text-[14px] font-bold no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";

  return (
    <>
      <style>{PRINT_CSS}</style>
      <Container className="flex flex-col gap-6 py-6 print:hidden sm:py-8">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-3xl font-black tracking-[-0.03em]">{t("qr.title")} <span className="font-serif text-royal">{t("qr.titleAccent")}</span></h2>
          <p className="m-0 max-w-2xl text-text-2">{t("qr.lead")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label={t("qr.format")} className="flex gap-2 rounded-full bg-tint p-1">
            <Link href={q({ format: "cards" })} aria-current={format === "cards" ? "page" : undefined} className={`${tab} ${format === "cards" ? "bg-ink text-white" : "text-ink"}`}>{t("qr.cards")}</Link>
            <Link href={q({ format: "poster" })} aria-current={format === "poster" ? "page" : undefined} className={`${tab} ${format === "poster" ? "bg-ink text-white" : "text-ink"}`}>{t("qr.poster")}</Link>
          </nav>
          <PrintButton label={t("qr.print")} />
          <a href={qr} download={`qr-${o.slug}.png`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-[1.5px] border-ink px-7 py-4 text-base font-extrabold text-ink no-underline transition-colors hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2"><Download size={20} aria-hidden />{t("qr.png")}</a>
        </div>
        <nav aria-label={t("qr.design")} className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-text-2">{t("qr.design")}</span>
          {TEMPLATES.map((x) => (
            <Link key={x.id} href={q({ template: x.id })} aria-current={template.id === x.id ? "page" : undefined}
              className={`${tab} gap-2 border-2 ${template.id === x.id ? "border-royal" : "border-transparent"} bg-tint text-ink`}>
              <span aria-hidden className="h-5 w-5 rounded-full border border-[#C8CAD2]" style={{ background: `linear-gradient(135deg, ${THEMES[x.theme].bg} 55%, ${THEMES[x.theme].accent} 55%)` }} />
              {x.name[locale]}
            </Link>
          ))}
        </nav>
        {days.length > 1 ? (
          <nav aria-label={t("qr.perDay")} className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-text-2">{t("qr.perDay")}</span>
            <Link href={q({ day: undefined })} aria-current={!day ? "page" : undefined} className={`${tab} ${!day ? "bg-royal text-white" : "bg-tint text-ink"}`}>{t("qr.allDays")}</Link>
            {days.map((d) => (
              <Link key={d.id} href={q({ day: d.id })} aria-current={day?.id === d.id ? "page" : undefined} className={`${tab} ${day?.id === d.id ? "bg-royal text-white" : "bg-tint text-ink"}`}>{d.name}</Link>
            ))}
          </nav>
        ) : null}
        <p className="m-0 text-sm text-muted">{format === "cards" ? t("qr.cardsHint") : t("qr.posterHint")}{day ? ` ${t("qr.dayHint", { day: day.name })}` : ""}</p>
        <div className="flex flex-col gap-3 rounded-[24px] bg-tint p-4">
          <code className="break-all text-[15px] font-semibold">{url}</code>
          <ShareButtons url={url} text={p("share.guestMessage", { title: o.title })} title={o.title}
            labels={{ whatsapp: t("share.whatsapp"), share: t("share.native"), copy: t("common.copyLink"), copied: t("common.copied") }} />
        </div>
      </Container>
      <div className="qr-screen-wrap overflow-x-auto px-5 pb-12 sm:px-8">
        <div className={`qr-sheet mx-auto ${format}`}>
          {format === "cards"
            ? [0, 1, 2, 3].map((i) => <div key={i}><QrArtwork {...art} size="card" /></div>)
            : <QrArtwork {...art} size="poster" />}
        </div>
      </div>
    </>
  );
}
