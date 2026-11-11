import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Footer, openSite } from "@/components/Footer";
import { Segmented } from "@/components/Form";
import { Icon, type IconName } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Heading, Txt } from "@/components/Text";
import { siteUrl, supportEmail } from "@/config";
import { useI18n } from "@/i18n";
import { listGuestSessions, removeGuestSession, type GuestSession } from "@/lib/guestSessions";
import { notificationsGranted, registerForPush } from "@/lib/push";
import { colors, MIN_TOUCH } from "@/theme";

function Row({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={20} color={danger ? colors.danger : colors.blue} />
      <Txt weight="bold" style={{ flex: 1 }} color={danger ? colors.danger : undefined}>
        {label}
      </Txt>
      <Icon name="chevronRight" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function AppSettings() {
  const { t, locale, setLocale, brand } = useI18n();
  const { token, host, signOut } = useAuth();
  const [joined, setJoined] = useState<GuestSession[]>([]);
  const [push, setPush] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void listGuestSessions().then(setJoined);
      void notificationsGranted().then(setPush);
    }, []),
  );

  const doSignOut = () =>
    Alert.alert(t("appSettings.signOutConfirm"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("appSettings.signOut"),
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);

  const deleteAccount = () =>
    Alert.alert(t("appSettings.deleteAccount"), t("appSettings.deleteAccountBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.continue"),
        style: "destructive",
        onPress: () => {
          const subject = encodeURIComponent(t("appSettings.deleteAccountSubject"));
          const body = encodeURIComponent(t("appSettings.deleteAccountMail", { email: host?.email ?? "" }));
          void Linking.openURL(`mailto:${supportEmail(brand)}?subject=${subject}&body=${body}`);
        },
      },
    ]);

  return (
    <Screen tone="light" scroll header={<AppHeader tone="light" back />}>
      <Heading size="lg" accent={t("appSettings.accent")}>
        {t("appSettings.title")}
      </Heading>

      <Card style={{ gap: 12 }}>
        <Txt weight="extrabold">{t("appSettings.language")}</Txt>
        <Segmented
          label={t("appSettings.language")}
          value={locale}
          onChange={setLocale}
          options={[
            { value: "tr", label: t("appSettings.turkish") },
            { value: "en", label: t("appSettings.english") },
          ]}
        />
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt weight="extrabold">{t("appSettings.account")}</Txt>
        {token ? (
          <>
            {host?.email ? <Txt muted>{host.email}</Txt> : null}
            <View style={{ gap: 4 }}>
              <Txt weight="bold">{t("appSettings.notifications")}</Txt>
              <Txt variant="small" muted>
                {push ? t("appSettings.notificationsOn") : t("appSettings.notificationsHelp")}
              </Txt>
            </View>
            {!push ? (
              <Button
                label={t("appSettings.enableNotifications")}
                icon="sparkles"
                size="md"
                variant="secondary"
                onPress={async () => {
                  const ok = await registerForPush({ prompt: true, channelName: t("push.channel") });
                  setPush(ok || (await notificationsGranted()));
                  if (!ok && !(await notificationsGranted())) void Linking.openSettings();
                }}
              />
            ) : null}
            <Row icon="logOut" label={t("appSettings.signOut")} onPress={doSignOut} />
            <Row icon="trash" label={t("appSettings.deleteAccount")} onPress={deleteAccount} danger />
          </>
        ) : (
          <>
            <Txt muted>{t("appSettings.notSignedIn")}</Txt>
            <Button label={t("nav.signIn")} size="md" onPress={() => router.push("/login")} />
          </>
        )}
      </Card>

      <Card style={{ gap: 8 }}>
        <Txt weight="extrabold">{t("appSettings.myEvents")}</Txt>
        {joined.length === 0 ? (
          <Txt variant="small" muted>
            {t("appSettings.noJoined")}
          </Txt>
        ) : (
          joined.map((g) => (
            <View key={g.slug} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={g.title ?? g.slug}
                onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: g.slug } })}
                style={{ flex: 1, minHeight: MIN_TOUCH, justifyContent: "center" }}
              >
                <Txt weight="bold" numberOfLines={1}>
                  {g.title ?? g.slug}
                </Txt>
                <Txt variant="caption" muted>
                  {g.name}
                </Txt>
              </Pressable>
              <Button
                full={false}
                size="sm"
                variant="ghost"
                label={t("appSettings.leave")}
                onPress={async () => {
                  await removeGuestSession(g.slug);
                  setJoined(await listGuestSessions());
                }}
              />
            </View>
          ))
        )}
      </Card>

      <Card style={{ gap: 4 }}>
        <Txt weight="extrabold">{t("appSettings.legal")}</Txt>
        <Row icon="lock" label={t("appSettings.privacy")} onPress={() => openSite(siteUrl(brand, "/privacy"))} />
        <Row icon="book" label={t("appSettings.terms")} onPress={() => openSite(siteUrl(brand, "/terms"))} />
        <Row icon="mail" label={t("footer.contact")} onPress={() => void Linking.openURL(`mailto:${supportEmail(brand)}`)} />
      </Card>

      <Txt variant="caption" muted center>
        {t("appSettings.version", { v: Constants.expoConfig?.version ?? "1.0.0" })}
      </Txt>
      <Footer tone="light" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: MIN_TOUCH },
});
