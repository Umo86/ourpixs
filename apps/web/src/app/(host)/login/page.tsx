import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/site";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { getHost } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "@/components/host/LoginForm";
import { Notice } from "@/components/app/Notice";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("login.metaTitle"), robots: { index: false, follow: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  // `reauth=1`: a fresh sign-in is required (admin area), so show the form even with a session. Suspended accounts never have one.
  if (sp.reauth !== "1" && (await getHost().catch(() => null))) redirect(next);
  const { t } = await getT("host");
  return (
    <>
      <SiteHeader variant="light" minimal />
      <main id="main" className="flex-1">
        <Container size="narrow" className="grid gap-10 py-10 sm:py-16 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div className="flex flex-col gap-4">
            <h1 className="m-0 text-[clamp(2.6rem,7vw,4.5rem)] font-black leading-[0.92] tracking-[-0.04em]">
              {t("login.title")} <span className="font-serif text-royal">{t("login.titleAccent")}</span>
            </h1>
            <p className="m-0 max-w-md text-lg text-text-2">{t("login.lead")}</p>
          </div>
          <div className="flex flex-col gap-4 rounded-[28px] bg-tint p-6 sm:p-8">
            {sp.suspended === "1" ? <Notice tone="error">{t("errors.account_suspended")}</Notice> : null}
            {sp.reauth === "1" ? <Notice>{t("login.reauth")}</Notice> : null}
            <LoginForm next={next} />
          </div>
        </Container>
      </main>
      <SiteFooter compact />
    </>
  );
}
