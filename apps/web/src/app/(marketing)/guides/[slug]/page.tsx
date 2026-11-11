import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBrand, getT } from "@/i18n";
import { makeT } from "@/i18n/shared";
import { BRANDS, MAIN_BRAND, brandBaseUrl } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";
import { START_HREF } from "@/components/site/constants";
import { buildMetadata, withLang } from "@/components/marketing/meta";
import { GUIDES, GUIDES_UI, counterpart, findGuideAnyLocale } from "@/content/guides";

export const dynamicParams = false;
export function generateStaticParams() {
  return [...GUIDES.en, ...GUIDES.tr].map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hit = findGuideAnyLocale(slug);
  if (!hit) return {};
  const en = counterpart("en", hit.guide.id);
  const tr = counterpart("tr", hit.guide.id);
  return buildMetadata({
    title: hit.guide.title,
    description: hit.guide.description,
    path: `/guides/${slug}`,
    paths: { en: `/guides/${en?.slug ?? slug}`, tr: `/guides/${tr?.slug ?? slug}` },
    type: "article",
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hit = findGuideAnyLocale(slug);
  if (!hit) notFound();
  const [{ locale }, brand] = await Promise.all([getT("marketing"), getBrand()]);
  // A guide written in the other language: send the visitor to its counterpart in their language.
  if (hit.locale !== locale) {
    const alt = counterpart(locale, hit.guide.id);
    if (alt) redirect(`/guides/${alt.slug}`);
  }
  const g = hit.guide;
  const ui = GUIDES_UI[hit.locale];
  const base = brandBaseUrl(brand);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    inLanguage: hit.locale,
    datePublished: g.date,
    dateModified: g.date,
    mainEntityOfPage: brand === MAIN_BRAND ? `${base}${withLang(`/guides/${g.slug}`, hit.locale)}` : `${base}/guides/${g.slug}`,
    author: { "@type": "Organization", name: BRANDS[MAIN_BRAND].name, url: brandBaseUrl(MAIN_BRAND) },
    publisher: { "@type": "Organization", name: BRANDS[MAIN_BRAND].name, url: brandBaseUrl(MAIN_BRAND) },
  };
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Container size="narrow" className="flex flex-col gap-8 py-14 sm:py-20">
        <Link href="/guides" className="text-sm font-bold text-royal no-underline">← {ui.back}</Link>
        <header className="flex flex-col gap-4">
          <Display as="h1" size="lg">{g.title}</Display>
          <p className="m-0 text-sm text-muted">
            {ui.published} <time dateTime={g.date}>{g.date}</time> · {ui.min.replace("{n}", String(g.minutes))}
          </p>
          <p className="m-0 text-xl leading-relaxed text-text-2">{g.description}</p>
        </header>
        {g.sections.map((s) => (
          <section key={s.h} className="flex flex-col gap-3">
            <h2 className="m-0 text-2xl font-extrabold tracking-[-0.03em]">{s.h}</h2>
            {s.p.map((p) => <p key={p} className="m-0 text-[17px] leading-[1.7] text-text-2">{p}</p>)}
          </section>
        ))}
        <aside className="flex flex-col items-start gap-3 rounded-[28px] bg-tint p-7">
          <h2 className="m-0 text-2xl font-extrabold tracking-[-0.03em]">{ui.ctaTitle}</h2>
          <p className="m-0 text-text-2">{ui.ctaBody}</p>
          <Button href={START_HREF}>{makeT(hit.locale, "common")("nav.startFree")} →</Button>
        </aside>
      </Container>
    </article>
  );
}
