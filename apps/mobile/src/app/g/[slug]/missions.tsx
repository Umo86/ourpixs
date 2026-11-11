import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { errorMessage, guestApi } from "@/api/client";
import type { GuestMission } from "@/api/types";
import { GuestHeader } from "@/components/EventBrand";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { EmptyState, ErrorView, Loading } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { useGuest } from "@/guest/GuestContext";
import { useI18n } from "@/i18n";
import { colors, radius } from "@/theme";

export default function GuestMissions() {
  const { t } = useI18n();
  const { slug, auth, occasion } = useGuest();
  const [missions, setMissions] = useState<GuestMission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMissions((await guestApi.missions(slug, auth)).missions);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [slug, auth, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const enabled = occasion?.missionsEnabled !== false;

  return (
    <Screen tone="dark" scroll bottomInset={false} header={<GuestHeader occasion={occasion} title={occasion?.title} />}>
      <Heading tone="dark" size="lg" accent={t("missions.accent")} accentColor={colors.blueOnDarkSoft}>
        {t("missions.title")}
      </Heading>
      {!enabled ? (
        <EmptyState tone="dark" icon="target" title={t("guest.missionsOff")} />
      ) : missions === null && !error ? (
        <Loading tone="dark" />
      ) : error && !missions ? (
        <ErrorView tone="dark" message={error} onRetry={load} />
      ) : !missions?.length ? (
        <EmptyState tone="dark" icon="target" title={t("missions.empty")} />
      ) : (
        <View style={{ gap: 12 }}>
          {missions.map((m, i) => (
            <View key={m.id} style={[styles.card, m.done && { borderColor: colors.blueOnDark, borderWidth: 2 }]}>
              <View style={[styles.num, { transform: [{ rotate: i % 2 ? "6deg" : "-6deg" }] }, m.done && { backgroundColor: colors.white }]}>
                {m.done ? <Icon name="check" size={18} color={colors.black} strokeWidth={3} /> : <Txt tone="dark" weight="black">{i + 1}</Txt>}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt tone="dark" weight="extrabold" variant="lead">
                  {m.title}
                </Txt>
                <Txt tone="dark" variant="caption" muted>
                  {m.done ? `${t("missions.done")} · ` : ""}
                  {t("missions.doneCount", { n: m.doneCount })}
                </Txt>
              </View>
              {!m.done ? (
                <Button
                  full={false}
                  size="sm"
                  tone="dark"
                  icon="camera"
                  label={t("missions.go")}
                  onPress={() => router.navigate({ pathname: "/g/[slug]/upload", params: { slug, missionId: m.id } })}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surfaceDark, borderRadius: radius.cardSm, padding: 14 },
  num: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
});
