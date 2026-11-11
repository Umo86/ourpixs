import { router } from "expo-router";

import { AppHeader } from "@/components/AppHeader";
import { Screen } from "@/components/Screen";
import { EmptyState } from "@/components/States";
import { useI18n } from "@/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <Screen tone="light" header={<AppHeader tone="light" back={() => router.replace("/")} />}>
      <EmptyState icon="alert" title={t("errors.notFound")} action={{ label: t("nav.home"), onPress: () => router.replace("/") }} />
    </Screen>
  );
}
