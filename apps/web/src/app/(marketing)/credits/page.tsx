import Image from "next/image";
import { getT } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";
import { CREDITS, MEDIA, PEXELS_HOME } from "@/components/marketing/constants";
import { pageMetadata } from "@/components/marketing/meta";

export const generateMetadata = () => pageMetadata("credits", "/credits");

export default async function CreditsPage() {
  const { t } = await getT("marketing");
  return (
    <Container className="flex flex-col gap-10 py-14 sm:py-20">
      <div className="flex flex-col gap-5">
        <Display as="h1" size="lg" accent={t("credits.accent")}>{t("credits.title")}</Display>
        <p className="m-0 max-w-[620px] text-lg leading-relaxed text-text-2">{t("credits.lead")}</p>
      </div>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4 p-0">
        {CREDITS.map((c) => (
          <li key={c.key} className="flex items-center gap-4 rounded-3xl bg-tint p-3">
            <div className="relative size-20 flex-none overflow-hidden rounded-2xl bg-ink">
              {c.key !== "video" ? <Image src={MEDIA[c.key]} alt="" fill sizes="80px" className="object-cover" /> : <Image src={MEDIA.poster} alt="" fill sizes="80px" className="object-cover" />}
            </div>
            <div>
              <p className="m-0 text-sm text-muted">{t(`credits.roles.${c.key}`)}</p>
              <p className="m-0 text-lg font-extrabold tracking-[-0.02em]">{c.name}</p>
            </div>
          </li>
        ))}
      </ul>
      <Button href={PEXELS_HOME} variant="secondary" className="self-start" target="_blank" rel="noopener noreferrer">{t("credits.link")}</Button>
    </Container>
  );
}
