import Image from "next/image";
import { getT } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";
import { CREDITS, MEDIA, PEXELS_HOME, UNSPLASH_HOME, mediaUrl } from "@/components/marketing/constants";
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
              <Image src={c.key !== "video" ? mediaUrl(c.key, 240) : MEDIA.poster} alt="" fill sizes="80px" className="object-cover" />
            </div>
            <div>
              <p className="m-0 text-sm text-muted">{t(`credits.roles.${c.key}`)}</p>
              <p className="m-0 text-lg font-extrabold tracking-[-0.02em]">
                {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-1 underline-offset-4 hover:text-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">{c.name}</a> : c.name}
              </p>
              <p className="m-0 text-sm text-muted">{t(c.source === "unsplash" ? "credits.onUnsplash" : "credits.onPexels")}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button href={UNSPLASH_HOME} variant="secondary" target="_blank" rel="noopener noreferrer">{t("credits.linkUnsplash")}</Button>
        <Button href={PEXELS_HOME} variant="secondary" target="_blank" rel="noopener noreferrer">{t("credits.link")}</Button>
      </div>
    </Container>
  );
}
