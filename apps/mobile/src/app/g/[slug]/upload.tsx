import { useLocalSearchParams } from "expo-router";

import { GuestHeader } from "@/components/EventBrand";
import { Screen } from "@/components/Screen";
import { Loading } from "@/components/States";
import { UploadPanel } from "@/components/UploadPanel";
import { planSpec } from "@/config";
import { useGuest } from "@/guest/GuestContext";
import { useI18n } from "@/i18n";

export default function GuestUpload() {
  const { t } = useI18n();
  const { missionId } = useLocalSearchParams<{ missionId?: string }>();
  const { slug, session, occasion, shotsUsed, consumeShot } = useGuest();
  const target = { type: "guest" as const, slug, token: session.token, pin: session.pin ?? null };
  const plan = planSpec(occasion?.plan);
  const shotsLeft = occasion?.disposableShots ? Math.max(0, occasion.disposableShots - shotsUsed) : null;

  return (
    <Screen tone="dark" header={<GuestHeader occasion={occasion} title={occasion?.title} />} bottomInset={false} contentStyle={{ paddingBottom: 0 }}>
      {!occasion ? (
        <Loading tone="dark" />
      ) : (
        <UploadPanel
          key={missionId ?? "none"}
          tone="dark"
          target={target}
          body={t("upload.guestBody")}
          allowVideo={plan.video}
          maxVideoBytes={plan.maxVideoBytes}
          maxVideoSeconds={plan.maxVideoSeconds}
          moments={occasion.moments}
          days={occasion.days.map((d) => ({ id: d.id, name: d.name }))}
          shotsLeft={shotsLeft}
          missionId={missionId}
          onDisposableShot={consumeShot}
          disabledReason={occasion.uploadOpen ? null : t("upload.closed")}
        />
      )}
    </Screen>
  );
}
