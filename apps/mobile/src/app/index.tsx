import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { AppHeader } from "@/components/AppHeader";
import { Button, IconButton } from "@/components/Button";
import { Pill, Sticker } from "@/components/Card";
import { Footer } from "@/components/Footer";
import { Screen } from "@/components/Screen";
import { Heading, Txt } from "@/components/Text";
import { demoImage } from "@/demo/data";
import { useI18n } from "@/i18n";
import { colors, radius } from "@/theme";

/** Welcome / onboarding. Dark brand hero, two paths: host or join. */
export default function Welcome() {
  const { t } = useI18n();
  const { token, host } = useAuth();

  return (
    <Screen
      tone="dark"
      scroll
      header={<AppHeader tone="dark" right={<IconButton icon="settings" label={t("nav.settings")} tone="dark" onPress={() => router.push("/settings")} />} />}
    >
      <View style={styles.hero}>
        <Image source={{ uri: demoImage("couple") }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,10,10,0.55)" }]} />
        <View style={{ position: "absolute", right: 16, top: 18 }}>
          <Sticker text={t("welcome.sticker")} size={98} />
        </View>
        <View style={{ gap: 10 }}>
          <Pill text={t("welcome.eyebrow")} tone="dark" />
          <Heading tone="dark" size="xl" accent={t("welcome.titleAccent")} accentColor={colors.blueOnDarkSoft}>
            {t("welcome.title1")}
          </Heading>
        </View>
      </View>

      <Txt tone="dark" variant="lead" muted>
        {t("welcome.body")}
      </Txt>

      <View style={{ gap: 12 }}>
        {token ? (
          <>
            <Button label={t("welcome.goToEvents")} iconRight="arrowRight" tone="dark" onPress={() => router.replace("/host")} />
            {host?.email ? (
              <Txt tone="dark" variant="small" muted center>
                {t("welcome.signedInAs", { email: host.email })}
              </Txt>
            ) : null}
          </>
        ) : (
          <Button label={t("welcome.host")} iconRight="arrowRight" tone="dark" onPress={() => router.push("/login")} />
        )}
        <Button label={t("welcome.join")} icon="scan" tone="dark" variant="inverse" onPress={() => router.push("/join")} />
      </View>

      <Footer tone="dark" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 380, borderRadius: radius.card + 8, overflow: "hidden", padding: 20, justifyContent: "flex-end", backgroundColor: colors.surfaceDark },
});
