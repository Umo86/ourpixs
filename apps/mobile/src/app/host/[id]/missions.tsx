import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { errorMessage, hostApi } from "@/api/client";
import type { Mission } from "@/api/types";
import { AppHeader } from "@/components/AppHeader";
import { Button, IconButton } from "@/components/Button";
import { Chip, Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { EmptyState, Loading, Notice } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { planSpec } from "@/config";
import { useOccasion } from "@/host/OccasionContext";
import { useI18n } from "@/i18n";
import { colors, radius } from "@/theme";

export default function HostMissions() {
  const { t, tList } = useI18n();
  const { id, occasion } = useOccasion();
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = planSpec(occasion?.plan).missions;

  const load = useCallback(async () => {
    try {
      setMissions((await hostApi.missions(id)).missions);
    } catch (e) {
      setMissions([]);
      Alert.alert(errorMessage(e, t));
    }
  }, [id, t]);
  useEffect(() => void load(), [load]);

  const add = async (value = title) => {
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    try {
      setMissions((await hostApi.addMission(id, v)).missions);
      setTitle("");
    } catch (e) {
      Alert.alert(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = (m: Mission) =>
    Alert.alert(t("missions.removeTitle"), m.title, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.remove"),
        style: "destructive",
        onPress: async () => {
          try {
            setMissions((await hostApi.removeMission(id, m.id)).missions);
          } catch (e) {
            Alert.alert(errorMessage(e, t));
          }
        },
      },
    ]);

  const existing = new Set((missions ?? []).map((m) => m.title.toLowerCase()));
  const suggestions = tList("missions.suggestions").filter((s) => !existing.has(s.toLowerCase()));

  return (
    <Screen header={<AppHeader tone="light" back={() => router.replace("/host")} title={occasion?.title} />} scroll bottomInset={false} keyboard>
      <Heading size="lg" accent={t("missions.accent")}>
        {t("missions.title")}
      </Heading>
      <Txt muted>{t("missions.body")}</Txt>
      {occasion && !allowed ? (
        <Notice text={t("missions.needsPlan")} icon="lock" action={{ label: t("settings.plan"), onPress: () => router.navigate({ pathname: "/host/[id]/settings", params: { id } }) }} />
      ) : null}

      <View style={{ gap: 10 }}>
        <Field label={t("missions.add")} placeholder={t("missions.placeholder")} value={title} onChangeText={setTitle} onSubmitEditing={() => void add()} returnKeyType="done" editable={allowed} />
        <Button label={t("missions.add")} icon="plus" loading={busy} disabled={!allowed || !title.trim()} onPress={() => void add()} />
      </View>

      {allowed && suggestions.length ? (
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Chip key={s} label={`+ ${s}`} onPress={() => void add(s)} />
          ))}
        </View>
      ) : null}

      {missions === null ? (
        <Loading />
      ) : missions.length === 0 ? (
        <EmptyState icon="target" title={t("missions.empty")} />
      ) : (
        <View style={{ gap: 10 }}>
          {missions.map((m, i) => (
            <View key={m.id} style={styles.row}>
              <View style={styles.num}>
                <Txt weight="black" color={colors.white}>
                  {i + 1}
                </Txt>
              </View>
              <Txt weight="bold" style={{ flex: 1 }}>
                {m.title}
              </Txt>
              <IconButton icon="trash" label={`${t("common.remove")}: ${m.title}`} onPress={() => remove(m)} variant="ghost" />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.tint, borderRadius: radius.cardSm, padding: 12, paddingLeft: 14 },
  num: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-6deg" }] },
});
