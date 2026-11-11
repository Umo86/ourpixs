import type { Metadata } from "next";
import { SiteHeader, SiteFooter, CookieNotice, supportEmail } from "@/components/site";
import { Button, Container } from "@/components/ui";
import { getBrand, getT } from "@/i18n";
import { getHost } from "@/lib/auth";
import { DeleteAccountButton } from "@/components/host/DeleteAccountButton";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("accountDelete.metaTitle") };
}

export default async function DeleteAccountPage() {
  const { t } = await getT("host");
  const host = await getHost().catch(() => null);
  const email = supportEmail(await getBrand());
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <SiteHeader variant="light" />
      <main id="main" className="flex-1">
        <Container size="narrow" className="flex flex-col gap-6 py-10 sm:py-16">
          <h1 className="m-0 text-[clamp(2.4rem,6vw,4rem)] font-black leading-[0.92] tracking-[-0.04em]">{t("accountDelete.title")}</h1>
          <p className="m-0 max-w-2xl text-lg text-text-2">{t("accountDelete.lead")}</p>
          <ul className="m-0 flex flex-col gap-2 pl-5 text-text-2">
            {t("accountDelete.points").split("|").map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="m-0 text-text-2">{t("accountDelete.guests")}</p>
          {host ? (
            <div className="flex flex-col gap-3 rounded-[28px] bg-tint p-6">
              <p className="m-0 font-bold">{t("accountDelete.signedInAs", { email: host.email })}</p>
              <DeleteAccountButton />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button href="/login?next=/account/delete">{t("accountDelete.signIn")}</Button>
              <span className="text-sm text-muted">{t("accountDelete.orEmail", { email })}</span>
            </div>
          )}
        </Container>
      </main>
      <SiteFooter />
      <CookieNotice />
    </div>
  );
}
