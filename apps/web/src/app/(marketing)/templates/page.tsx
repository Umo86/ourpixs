import QRCode from "qrcode";
import { getBrand, getT } from "@/i18n";
import { brandBaseUrl } from "@/lib/config";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";
import { DEMO_GUEST_HREF } from "@/components/site/constants";
import { TemplateGallery } from "@/components/marketing/TemplateGallery";
import { buildMetadata } from "@/components/marketing/meta";
import { TEMPLATE_COPY } from "@/content/templates";

export async function generateMetadata() {
  const { locale } = await getT("marketing");
  const c = TEMPLATE_COPY[locale];
  return buildMetadata({ title: c.metaTitle, description: c.metaDesc, path: "/templates" });
}

export default async function TemplatesPage() {
  const [{ locale }, brand] = await Promise.all([getT("marketing"), getBrand()]);
  const c = TEMPLATE_COPY[locale];
  const qrSvg = await QRCode.toString(brandBaseUrl(brand) + DEMO_GUEST_HREF, { type: "svg", margin: 0, color: { dark: "#0A0A0A", light: "#FFFFFF" } });
  return (
    <Container className="flex flex-col gap-10 py-14 sm:py-20">
      <div className="flex flex-col gap-5">
        <Display as="h1" size="xl" accent={c.accent}>{c.title}</Display>
        <p className="m-0 max-w-[640px] text-lg leading-relaxed text-text-2">{c.lead}</p>
      </div>
      <TemplateGallery copy={c} qrSvg={qrSvg} qrAlt={c.qrAlt} />
      <p className="m-0 max-w-[640px] text-sm text-muted">{c.note}</p>
    </Container>
  );
}
