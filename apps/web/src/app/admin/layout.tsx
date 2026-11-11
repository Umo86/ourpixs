import type { Metadata } from "next";
import { SiteHeader } from "@/components/site";
import { Sticker } from "@/components/ui";
import { AccountMenu } from "@/components/host/AccountMenu";
import { AdminNav } from "@/components/admin/AdminNav";
import { getT } from "@/i18n";
import { currentAdmin, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Never indexed. The title is only set for admins, so nothing about this area shows to anyone else. */
export async function generateMetadata(): Promise<Metadata> {
  const robots = { index: false, follow: false, nocache: true };
  if (!(await currentAdmin())) return { robots };
  const { t } = await getT("admin");
  return { title: t("meta.title"), robots };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const { t } = await getT("admin");
  const items = [
    { key: "overview" as const, href: "/admin", label: t("nav.overview") },
    { key: "users" as const, href: "/admin/users", label: t("nav.users") },
    { key: "events" as const, href: "/admin/events", label: t("nav.events") },
    { key: "moderation" as const, href: "/admin/moderation", label: t("nav.moderation") },
    { key: "enquiries" as const, href: "/admin/enquiries", label: t("nav.enquiries") },
    { key: "audit" as const, href: "/admin/audit", label: t("nav.audit") },
    { key: "system" as const, href: "/admin/system", label: t("nav.system") },
  ];
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <SiteHeader variant="light" minimal right={
        <div className="flex items-center gap-3">
          <Sticker tone="ink" rotate={-4} caps className="hidden !px-3 !py-1.5 !text-[11px] sm:inline-block">{t("shell.badge")}</Sticker>
          <AccountMenu email={admin.email} />
        </div>
      } />
      <div className="mx-auto w-full max-w-[1360px] flex-1 px-5 pb-16 sm:px-8">
        <div className="md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-10">
          <AdminNav items={items} label={t("shell.nav")} />
          <main id="main" className="flex min-w-0 flex-col gap-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
