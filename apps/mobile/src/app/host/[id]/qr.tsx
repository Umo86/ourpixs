import { router } from "expo-router";

import { AppHeader } from "@/components/AppHeader";
import { QrCard } from "@/components/QrCard";
import { Screen } from "@/components/Screen";
import { Loading } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { useOccasion } from "@/host/OccasionContext";
import { useI18n } from "@/i18n";

export default function HostQr() {
  const { t } = useI18n();
  const { occasion } = useOccasion();
  return (
    <Screen header={<AppHeader tone="light" back={() => router.replace("/host")} title={occasion?.title} />} scroll={!!occasion} bottomInset={false}>
      {!occasion ? (
        <Loading />
      ) : (
        <>
          <Heading size="lg" accent={t("qr.accent")}>
            {t("qr.title")}
          </Heading>
          <Txt muted>{t("qr.body")}</Txt>
          <QrCard url={occasion.guestUrl} slug={occasion.slug} title={occasion.title} />
        </>
      )}
    </Screen>
  );
}
