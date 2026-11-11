import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Field } from "@/components/Form";
import { LanguageSwitch } from "@/components/Footer";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Heading, Txt } from "@/components/Text";
import { DEMO_MODE } from "@/config";
import { useI18n } from "@/i18n";
import { parseEventCode } from "@/lib/guestSessions";
import { colors, radius } from "@/theme";

export default function JoinScan() {
  const { t } = useI18n();
  const [perm, requestPerm] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const handled = useRef(false);

  // Re-arm the scanner whenever the screen regains focus.
  useFocusEffect(
    useCallback(() => {
      handled.current = false;
      setActive(true);
      return () => setActive(false);
    }, []),
  );

  const go = (slug: string) => {
    handled.current = true;
    setActive(false);
    router.push({ pathname: "/join/[slug]", params: { slug } });
  };

  const onScan = ({ data }: { data: string }) => {
    if (handled.current) return;
    const slug = parseEventCode(data);
    if (!slug) return;
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    go(slug);
  };

  const submit = () => {
    const slug = parseEventCode(code);
    if (!slug) return setError(t("join.invalid"));
    setError(null);
    go(slug);
  };

  const showCamera = perm?.granted && !DEMO_MODE && Platform.OS !== "web";

  return (
    <Screen tone="dark" scroll keyboard header={<AppHeader tone="dark" back right={<LanguageSwitch tone="dark" />} />}>
      <Heading tone="dark" size="lg" accent={t("join.accent")}>
        {t("join.title")}
      </Heading>
      <Txt tone="dark" muted>
        {t("join.scanHelp")}
      </Txt>

      <View style={styles.viewfinder}>
        {showCamera && active ? (
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScan} />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="scan" size={48} color={colors.blueOnDarkSoft} />
            {perm && !perm.granted && !DEMO_MODE ? (
              <>
                <Txt tone="dark" center muted>
                  {t("join.needCamera")}
                </Txt>
                <Button
                  full={false}
                  size="md"
                  tone="dark"
                  label={perm.canAskAgain ? t("join.allowCamera") : t("errors.openSettings")}
                  onPress={() => (perm.canAskAgain ? void requestPerm() : void Linking.openSettings())}
                />
              </>
            ) : null}
          </View>
        )}
        <View pointerEvents="none" style={styles.frame} />
      </View>

      <Field
        tone="dark"
        label={t("join.orCode")}
        placeholder={t("join.codePlaceholder")}
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error}
      />
      <Button label={t("join.go")} tone="dark" iconRight="arrowRight" onPress={submit} disabled={!code.trim()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewfinder: { height: 320, borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.surfaceDark },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  frame: { position: "absolute", left: 50, right: 50, top: 50, bottom: 50, borderWidth: 3, borderColor: colors.white, borderRadius: 24, opacity: 0.9 },
});
