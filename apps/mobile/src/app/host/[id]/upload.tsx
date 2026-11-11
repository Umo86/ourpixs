import { router } from "expo-router";

import { AppHeader } from "@/components/AppHeader";
import { Screen } from "@/components/Screen";
import { Loading } from "@/components/States";
import { UploadPanel } from "@/components/UploadPanel";
import { planSpec } from "@/config";
import { useOccasion } from "@/host/OccasionContext";
import { useI18n } from "@/i18n";

export default function HostUpload() {
  const { t } = useI18n();
  const { id, occasion } = useOccasion();
  const plan = planSpec(occasion?.plan);
  return (
    <Screen header={<AppHeader tone="light" back={() => router.replace("/host")} title={occasion?.title} />} bottomInset={false} contentStyle={{ paddingBottom: 0 }}>
      {!occasion ? (
        <Loading />
      ) : (
        <UploadPanel
          tone="light"
          target={{ type: "host", occasionId: id }}
          body={t("upload.hostBody")}
          allowVideo={plan.video}
          maxVideoBytes={plan.maxVideoBytes}
          maxVideoSeconds={plan.maxVideoSeconds}
          days={occasion.days.map((d) => ({ id: d.id, name: d.name }))}
        />
      )}
    </Screen>
  );
}
