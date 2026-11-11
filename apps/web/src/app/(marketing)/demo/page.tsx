import Image from "next/image";
import QRCode from "qrcode";
import { getBrand, getT } from "@/i18n";
import { brandBaseUrl } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";
import { Sticker } from "@/components/ui/Sticker";
import { DEMO_GUEST_HREF, START_HREF } from "@/components/site/constants";
import { DemoFeed } from "@/components/marketing/DemoFeed";
import { buildMetadata } from "@/components/marketing/meta";
import { DEMO_COPY } from "@/content/demo";

export async function generateMetadata() {
  const { locale } = await getT("marketing");
  return buildMetadata({ title: DEMO_COPY[locale].metaTitle, description: DEMO_COPY[locale].metaDesc, path: "/demo" });
}

export default async function DemoPage() {
  const [{ locale }, brand] = await Promise.all([getT("marketing"), getBrand()]);
  const c = DEMO_COPY[locale];
  const qr = await QRCode.toDataURL(brandBaseUrl(brand) + DEMO_GUEST_HREF, { margin: 1, width: 360, color: { dark: "#0A0A0A", light: "#FFFFFF" } });
  return (
    <section className="py-12 sm:py-20">
      <Container className="flex flex-wrap items-start gap-12 lg:gap-16">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-7">
          <Sticker caps tone="royal" rotate={-2} className="self-start">{c.sticker}</Sticker>
          <Display as="h1" size="xl" accent={c.accent}>{c.title}</Display>
          <p className="m-0 max-w-[520px] text-lg leading-relaxed text-text-2">{c.lead}</p>
          <p role="note" className="m-0 max-w-[520px] rounded-2xl bg-tint px-4 py-3 text-sm font-semibold">{c.notice}</p>
          <div className="flex flex-wrap items-center gap-6 rounded-[28px] bg-ink p-6 text-white">
            <Image src={qr} alt={c.qrAlt} width={160} height={160} unoptimized className="size-40 rounded-2xl bg-white" />
            <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-3">
              <h2 className="m-0 text-2xl font-extrabold tracking-[-0.03em]">{c.qrTitle}</h2>
              <p className="m-0 text-muted-dark">{c.qrBody}</p>
              <Button href={DEMO_GUEST_HREF} variant="light">{c.guestCta}</Button>
            </div>
          </div>
          <div>
            <h2 className="m-0 mb-3 text-xl font-extrabold tracking-[-0.03em]">{c.stepsTitle}</h2>
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {c.steps.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span aria-hidden className="flex size-8 flex-none items-center justify-center rounded-full bg-royal text-sm font-extrabold text-white">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <Button href={START_HREF} size="lg" className="self-start">{c.createCta}</Button>
        </div>
        <div className="min-w-0 flex-[1_1_360px]">
          <DemoFeed event={c.event} tabs={c.tabs} photos={c.photos} likeLabel={c.likeLabel} likedLabel={c.likedLabel} ago={c.ago} by={c.by} />
        </div>
      </Container>
    </section>
  );
}
