import { SiteHeader, SiteFooter } from "@/components/site";
import { requireHostPage } from "@/lib/auth";
import { AccountMenu } from "@/components/host/AccountMenu";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const host = await requireHostPage("/dashboard");
  return (
    <>
      <SiteHeader variant="light" minimal className="print:hidden" right={<AccountMenu email={host.email} />} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter compact className="print:hidden" />
    </>
  );
}
