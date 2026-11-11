import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "@/i18n";
import type { PickedAsset } from "@/upload/queue";
import { colors } from "@/theme";
import { Button, IconButton } from "./Button";
import { Pill } from "./Card";
import { Heading, Txt } from "./Text";

/**
 * Full-screen camera. Each shot is handed to `onShot` immediately (it goes straight into the upload queue).
 * `shotsLeft` turns it into a disposable camera.
 */
export function CameraCapture({ visible, onClose, onShot, shotsLeft }: {
  visible: boolean; onClose: () => void; onShot: (a: PickedAsset) => void; shotsLeft?: number | null;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const cam = useRef<CameraView>(null);
  const noShots = shotsLeft != null && shotsLeft <= 0;

  const shoot = async () => {
    if (!cam.current || busy || noShots) return;
    setBusy(true);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.92, exif: false, skipProcessing: false });
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      onShot({ uri: pic.uri, kind: "photo", mime: "image/jpeg", width: pic.width, height: pic.height });
    } catch {
      // ignore single failed capture
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {!perm ? null : !perm.granted ? (
          <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
            <Heading tone="dark" size="md" center>
              {t("camera.needPermission")}
            </Heading>
            <Button
              label={perm.canAskAgain ? t("camera.allow") : t("errors.openSettings")}
              onPress={() => (perm.canAskAgain ? void requestPerm() : void Linking.openSettings())}
              tone="dark"
            />
          </View>
        ) : (
          <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} mode="picture" />
        )}

        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="x" label={t("camera.close")} onPress={onClose} variant="glass" />
          {shotsLeft != null ? <Pill text={noShots ? t("camera.noShots") : t("camera.shotsLeft", { n: shotsLeft })} variant="glass" /> : null}
          <IconButton icon="flip" label={t("camera.flip")} onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} variant="glass" />
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
          {flash ? <Pill text={t("camera.sent")} variant="blue" rotate={-3} /> : <View style={{ height: 28 }} />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("camera.shutter")}
            accessibilityState={{ disabled: busy || noShots }}
            disabled={busy || noShots || !perm?.granted}
            onPress={shoot}
            style={({ pressed }) => [styles.shutter, { opacity: noShots ? 0.4 : pressed ? 0.8 : 1 }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <Txt tone="dark" variant="caption" muted>
            {t("camera.title")}
          </Txt>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, padding: 24, gap: 20, alignItems: "stretch" },
  top: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", gap: 14 },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: colors.white, alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blue },
});
