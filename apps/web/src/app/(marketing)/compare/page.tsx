import { Check, Minus, X, CircleHelp } from "lucide-react";
import { getBrand, getT } from "@/i18n";
import { makeT } from "@/i18n/shared";
import { BRANDS, SUPPORT_EMAIL } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { fill, pricingVars } from "@/components/marketing/format";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";
import { START_HREF } from "@/components/site/constants";
import { buildMetadata } from "@/components/marketing/meta";
import { COMPARE, type Mark } from "@/content/compare";

export async function generateMetadata() {
  const { locale } = await getT("marketing");
  return buildMetadata(
    locale === "tr"
      ? { title: "WhatsApp, Google Fotoğraflar ve QR uygulamalarıyla karşılaştırma", description: "Misafir fotoğraflarını toplamak için WhatsApp grupları, Google Fotoğraflar ortak albümleri ve diğer QR uygulamaları arasında adil bir karşılaştırma.", path: "/compare" }
      : { title: "Compare: WhatsApp groups, Google Photos and QR photo apps", description: "A fair, factual comparison of ways to collect guest photos: WhatsApp groups, Google Photos shared albums and other QR photo apps.", path: "/compare" },
  );
}

const ICON: Record<Mark, { Icon: typeof Check; cls: string }> = {
  yes: { Icon: Check, cls: "bg-royal text-white" },
  partial: { Icon: Minus, cls: "bg-tint text-ink" },
  no: { Icon: X, cls: "bg-[#F1E4E4] text-[#8A1F1F]" },
  varies: { Icon: CircleHelp, cls: "bg-tint text-ink" },
};

export default async function ComparePage() {
  const [{ locale }, brand, settings] = await Promise.all([getT("marketing"), getBrand(), getSettings()]);
  const vars = pricingVars(SUPPORT_EMAIL[brand], settings);
  const c = COMPARE[locale];
  const name = BRANDS[brand].name;
  return (
    <>
      <section className="py-14 sm:py-20">
        <Container className="flex flex-col gap-6">
          <Display as="h1" size="xl" accent={c.accent}>{c.title}</Display>
          <p className="m-0 max-w-[720px] text-lg leading-relaxed text-text-2">{c.lead}</p>
          <p className="m-0 text-sm text-muted">{c.updated}</p>
        </Container>
      </section>

      <section>
        <Container>
          <div className="relative overflow-x-auto rounded-[28px] border border-[#E3E5EE]">{/* relative: contains the sr-only cells, which otherwise widen the page on phones */}
            <table className="w-full min-w-[820px] border-collapse text-left text-[15px]">
              <caption className="sr-only">{c.title} {c.accent}</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[24%] bg-white p-4" />
                  {c.cols.map((col, i) => (
                    <th key={col} scope="col" className={`p-4 text-base font-extrabold ${i === 0 ? "bg-royal text-white" : "bg-tint"}`}>{col.replace("{brand}", name)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.label} className="border-t border-[#E3E5EE] align-top">
                    <th scope="row" className="p-4 font-bold">{r.label}</th>
                    {r.cells.map(([mark, text], i) => {
                      const { Icon, cls } = ICON[mark];
                      return (
                        <td key={i} className={`p-4 ${i === 0 ? "bg-[#F6F8FF]" : ""}`}>
                          <span className="flex items-start gap-2.5">
                            <span className={`mt-0.5 inline-flex size-6 flex-none items-center justify-center rounded-full ${cls}`}>
                              <Icon size={14} aria-hidden />
                              <span className="sr-only">{c.marks[mark]}</span>
                            </span>
                            <span className="leading-snug text-text-2">{fill(text, vars)}</span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container size="narrow" className="flex flex-col gap-6">
          <Display size="md" accent="">{c.fairTitle}</Display>
          <ul className="m-0 flex list-disc flex-col gap-3 pl-6 text-[17px] leading-relaxed text-text-2">
            {c.fair.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Button href={START_HREF} size="lg">{makeT(locale, "common")("nav.startFree")} →</Button>
            <p className="m-0 text-text-2">{c.ctaNote}</p>
          </div>
        </Container>
      </section>
    </>
  );
}
