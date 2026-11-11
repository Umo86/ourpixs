import { getT } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";

export default async function NotFound() {
  const { t } = await getT("marketing");
  return (
    <Container className="flex flex-col items-start gap-8 py-24 sm:py-32">
      <Display as="h1" size="xl" accent={t("notFound.accent")}>{t("notFound.title")}</Display>
      <p className="m-0 max-w-[520px] text-lg text-text-2">{t("notFound.body")}</p>
      <Button href="/" size="lg">{t("site.backHome")}</Button>
    </Container>
  );
}
