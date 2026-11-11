import { Image } from "expo-image";
import { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, View } from "react-native";

import { useI18n } from "@/i18n";
import { pickFromLibrary } from "@/upload/pick";
import { clearFinished, enqueue, retryFailed, targetKey, useUploadQueue, type PickedAsset, type QueueItem, type UploadExtras, type UploadTarget } from "@/upload/queue";
import { colors, palette, radius, type Tone } from "@/theme";
import { Button } from "./Button";
import { CameraCapture } from "./CameraCapture";
import { Chip } from "./Form";
import { Icon } from "./Icon";
import { Notice, ProgressBar } from "./States";
import { Heading, Txt } from "./Text";

function statusLabel(t: ReturnType<typeof useI18n>["t"], i: QueueItem) {
  switch (i.status) {
    case "queued": return t("upload.queued");
    case "preparing": return t("upload.preparing");
    case "uploading": return `${t("upload.uploading")} ${Math.round(i.progress * 100)}%`;
    case "done": return t("upload.done");
    case "failed": return t("upload.failed");
  }
}

/**
 * Upload screen body shared by host and guest: pick from library, take photos, and watch the queue.
 * Moments/days are optional taggers (guests).
 */
export function UploadPanel({ target, tone, body, allowVideo, maxVideoBytes, maxVideoSeconds, moments = [], days = [], shotsLeft, disabledReason, missionId, onDisposableShot }: {
  target: UploadTarget;
  tone: Tone;
  body: string;
  allowVideo: boolean;
  maxVideoBytes?: number;
  maxVideoSeconds?: number;
  moments?: string[];
  days?: { id: string; name: string }[];
  shotsLeft?: number | null;
  disabledReason?: string | null;
  missionId?: string;
  onDisposableShot?: () => void;
}) {
  const { t } = useI18n();
  const p = palette(tone);
  const key = targetKey(target);
  const q = useUploadQueue(key);
  const [camera, setCamera] = useState(false);
  const [moment, setMoment] = useState<string | null>(null);
  const [dayId, setDayId] = useState<string | null>(days.length === 1 ? days[0].id : null);
  const extras: UploadExtras = { momentTag: moment ?? undefined, dayId: dayId ?? undefined, missionId };

  const addAssets = (assets: PickedAsset[], fromDisposable = false) => {
    const ok: PickedAsset[] = [];
    for (const a of assets) {
      if (a.kind === "video" && !allowVideo) continue;
      if (a.kind === "video" && maxVideoBytes && a.bytes && a.bytes > maxVideoBytes) {
        Alert.alert(t("upload.tooBig", { name: a.name ?? "" }));
        continue;
      }
      ok.push(a);
    }
    if (ok.length) enqueue(target, ok, { ...extras, fromDisposable: fromDisposable || undefined });
  };

  const pick = async () => {
    try {
      const assets = await pickFromLibrary({ allowVideo, maxVideoSeconds });
      addAssets(assets);
    } catch {
      Alert.alert(t("errors.permissionPhotos"), undefined, [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("errors.openSettings"), onPress: () => void Linking.openSettings() },
      ]);
    }
  };

  const finished = q.total > 0 && q.inFlight === 0;
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Heading tone={tone} size="lg" accent={t("upload.accent")}>
        {t("upload.title")}
      </Heading>
      <Txt tone={tone} muted>
        {body}
      </Txt>

      {disabledReason ? <Notice tone={tone} text={disabledReason} icon="lock" /> : null}
      {!allowVideo && !disabledReason ? <Notice tone={tone} text={t("upload.videosNeedPlan")} icon="video" /> : null}

      {days.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Txt tone={tone} variant="label" weight="semibold" muted>
            {t("upload.day")}
          </Txt>
          <View style={styles.chips}>
            {days.map((d) => (
              <Chip key={d.id} label={d.name} selected={dayId === d.id} onPress={() => setDayId(dayId === d.id ? null : d.id)} tone={tone} />
            ))}
          </View>
        </View>
      ) : null}

      {moments.length ? (
        <View style={{ gap: 8 }}>
          <Txt tone={tone} variant="label" weight="semibold" muted>
            {t("upload.moment")}
          </Txt>
          <View style={styles.chips}>
            <Chip label={t("upload.noMoment")} selected={!moment} onPress={() => setMoment(null)} tone={tone} />
            {moments.map((m) => (
              <Chip key={m} label={m} selected={moment === m} onPress={() => setMoment(m)} tone={tone} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Button label={t("upload.pick")} icon="image" onPress={pick} tone={tone} disabled={!!disabledReason} />
        <Button label={t("upload.camera")} icon="camera" variant={tone === "dark" ? "inverse" : "secondary"} onPress={() => setCamera(true)} tone={tone} disabled={!!disabledReason} />
      </View>

      {q.total > 0 ? (
        <View style={[styles.card, { backgroundColor: p.surface }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt tone={tone} weight="extrabold" accessibilityLiveRegion="polite">
              {finished && q.failed === 0
                ? q.done === 1 ? t("upload.allDoneOne") : t("upload.allDone", { n: q.done })
                : t("upload.progress", { done: q.done, total: q.total })}
            </Txt>
            {finished && q.failed === 0 ? <Icon name="checkCircle" size={22} color={p.accent} /> : null}
          </View>
          <ProgressBar value={q.progress} tone={tone} label={t("upload.progress", { done: q.done, total: q.total })} />
          {q.inFlight > 0 ? (
            <Txt tone={tone} variant="caption" muted>
              {t("upload.weakNetwork")}
            </Txt>
          ) : null}
          <View style={{ gap: 8 }}>
            {q.items.slice(-30).reverse().map((i) => (
              <View key={i.id} style={styles.row}>
                <Image source={{ uri: i.asset.uri }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt tone={tone} variant="small" weight="semibold" color={i.status === "failed" ? p.danger : undefined}>
                    {statusLabel(t, i)}
                  </Txt>
                  {i.status === "uploading" || i.status === "preparing" ? <ProgressBar value={i.progress} tone={tone} /> : null}
                </View>
                {i.status === "done" ? <Icon name="check" size={18} color={p.accent} /> : null}
                {i.status === "failed" ? <Icon name="alert" size={18} color={p.danger} /> : null}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {q.failed > 0 ? <Button label={t("upload.retryFailed")} icon="refresh" size="sm" full={false} onPress={() => retryFailed(key)} tone={tone} /> : null}
            {q.done > 0 ? <Button label={t("upload.clear")} size="sm" variant="ghost" full={false} onPress={() => clearFinished(key)} tone={tone} /> : null}
          </View>
        </View>
      ) : null}

      <CameraCapture
        visible={camera}
        onClose={() => setCamera(false)}
        shotsLeft={shotsLeft}
        onShot={(a) => {
          if (shotsLeft != null) onDisposableShot?.();
          addAssets([a], shotsLeft != null);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { borderRadius: radius.card, padding: 18, gap: 12 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surfaceDark2 },
});
