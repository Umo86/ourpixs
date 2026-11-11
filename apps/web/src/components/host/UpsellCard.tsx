import { Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { getT } from "@/i18n";

export async function UpsellCard({ occasionId, feature }: { occasionId: string; feature: string }) {
  const { t } = await getT("host");
  return (
    <div className="flex flex-col items-start gap-4 rounded-[28px] bg-ink p-7 text-white">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-royal"><Lock size={22} aria-hidden /></span>
      <h3 className="m-0 text-2xl font-black tracking-tight">{t("upsell.title", { feature })}</h3>
      <p className="m-0 text-muted-dark">{t("upsell.body")}</p>
      <Button href={`/dashboard/${occasionId}/settings#plan`} variant="light">{t("upsell.cta")}</Button>
    </div>
  );
}
