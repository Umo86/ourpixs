import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { errorMessage, hostApi } from "@/api/client";
import type { OccasionSummary } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { AppHeader } from "@/components/AppHeader";
import { Button, IconButton } from "@/components/Button";
import { Pill } from "@/components/Card";
import { packageLine } from "@/components/PackageStatus";
import { Screen } from "@/components/Screen";
import { EmptyState, ErrorView, Loading } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { occasionLabel } from "@/config";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { colors, radius } from "@/theme";

function CoverCard({ o }: { o: OccasionSummary }) {
  const { t, locale } = useI18n();
  const meta = [occasionLabel(o.type, locale), o.startsOn ? formatDate(o.startsOn, locale) : t("host.noDate")].join(" · ");
  // Package status, neutrally: Setup / Opens … / Live until … / Ended · download until … (no prices).
  const status = packageLine(o, t, locale).label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${o.title}. ${meta}. ${status}. ${t("host.mediaCount", { n: o.mediaCount })}`}
      onPress={() => router.push({ pathname: "/host/[id]", params: { id: o.id } })}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
    >
      {o.coverUrl ? (
        <Image source={{ uri: o.coverUrl, cacheKey: `cover-${o.id}` }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: o.coverUrl ? "rgba(10,10,10,0.38)" : colors.black }]} />
      <View style={[styles.cardTop, { flexDirection: "column", gap: 8 }]}>
        <Pill text={meta} tone="dark" />
        <Pill text={status} tone="dark" variant="blue" />
      </View>
      <View style={{ gap: 6 }}>
        <Heading tone="dark" size="md" numberOfLines={2}>
          {o.title}
        </Heading>
        <Txt tone="dark" variant="small" weight="semibold">
          {t("host.mediaCount", { n: o.mediaCount })} · {t("host.guestCount", { n: o.guestCount })}
          {o.role === "cohost" ? ` · ${t("host.roleCohost")}` : ""}
        </Txt>
      </View>
    </Pressable>
  );
}

export default function HostHome() {
  const { t } = useI18n();
  const [list, setList] = useState<OccasionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { refreshMe } = useAuth();

  const load = useCallback(async () => {
    try {
      const { occasions } = await hostApi.list();
      setList(occasions);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t));
    }
    // Keep the profile fresh (name, language) while away.
    void refreshMe();
  }, [t, refreshMe]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const header = (
    <AppHeader
      tone="light"
      right={
        <>
          <IconButton icon="plus" label={t("host.newEvent")} variant="primary" onPress={() => router.push("/host/new")} />
          <IconButton icon="settings" label={t("nav.settings")} onPress={() => router.push("/settings")} />
        </>
      }
    />
  );

  return (
    <Screen tone="light" header={header}>
      {list === null && !error ? (
        <Loading />
      ) : error && !list ? (
        <ErrorView message={error} onRetry={load} />
      ) : (
        <FlatList
          data={list ?? []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.blue} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              <Heading size="lg" accent={t("host.homeAccent")} style={{ marginBottom: 4 }}>
                {t("host.homeTitle")}
              </Heading>
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="sparkles" title={t("host.empty")} body={t("host.emptyBody")} action={{ label: t("host.createFirst"), onPress: () => router.push("/host/new") }} />
          }
          ListFooterComponent={list && list.length ? <Button label={t("host.newEvent")} icon="plus" variant="secondary" onPress={() => router.push("/host/new")} /> : undefined}
          renderItem={({ item }) => <CoverCard o={item} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { height: 280, borderRadius: radius.card, overflow: "hidden", padding: 18, justifyContent: "space-between", backgroundColor: colors.black },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
});
