import { useLocalSearchParams } from "expo-router";

import { GuestHeader } from "@/components/EventBrand";
import { Screen } from "@/components/Screen";
import { Loading } from "@/components/States";
import { UploadPanel } from "@/components/UploadPanel";
import { guestUploadsClosed } from "@/lib/uploadsOpen";
import { useGuest } from "@/guest/GuestContext";
import { useI18n } from "@/i18n";

export default function GuestUpload() {
  const { t } = useI18n();
  const { missionId } = useLocalSearchParams<{ missionId?: string }>();
  const { slug, session, occasion, shotsUsed, consumeShot } = useGuest();
  const target = { type: "guest" as const, slug, token: session.token, pin: session.pin ?? null };
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
          moments={occasion.moments}
          days={occasion.days.map((d) => ({ id: d.id, name: d.name }))}
          shotsLeft={shotsLeft}
          missionId={missionId}
          onDisposableShot={consumeShot}
          maxVideoSeconds={occasion.videoMaxSeconds ?? 60}
          disabledReason={guestUploadsClosed(occasion) ? t("upload.closed") : null}
        />
      )}
    </Screen>
  );
}
