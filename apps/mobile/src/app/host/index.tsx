import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { errorMessage, hostApi, orgApi } from "@/api/client";
import type { OccasionSummary, Organisation } from "@/api/types";
import { AppHeader } from "@/components/AppHeader";
import { Button, IconButton } from "@/components/Button";
import { Pill, Sticker } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { EmptyState, ErrorView, Loading } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { occasionLabel, PLANS } from "@/config";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { colors, radius } from "@/theme";

function CoverCard({ o, compact }: { o: OccasionSummary; compact?: boolean }) {
  const { t, locale } = useI18n();
  const meta = [occasionLabel(o.type, locale), o.startsOn ? formatDate(o.startsOn, locale) : t("host.noDate")].join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${o.title}. ${meta}. ${t("host.mediaCount", { n: o.mediaCount })}`}
      onPress={() => router.push({ pathname: "/host/[id]", params: { id: o.id } })}
      style={({ pressed }) => [styles.card, compact && styles.compact, { opacity: pressed ? 0.9 : 1 }]}
    >
      {o.coverUrl ? (
        <Image source={{ uri: o.coverUrl, cacheKey: `cover-${o.id}` }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: o.coverUrl ? "rgba(10,10,10,0.38)" : colors.black }]} />
      <View style={styles.cardTop}>
        <Pill text={meta} tone="dark" />
        {o.plan !== "free" && !compact ? <Sticker text={PLANS[o.plan].name[locale]} size={64} rotate={10} /> : null}
      </View>
      <View style={{ gap: 6 }}>
        <Heading tone="dark" size={compact ? "sm" : "md"} numberOfLines={2}>
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
  const [venues, setVenues] = useState<{ org: Organisation; occasions: OccasionSummary[] }[]>([]);

  const load = useCallback(async () => {
    try {
      const { occasions } = await hostApi.list();
      setList(occasions);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t));
    }
    // Venue (Partner) organisations are optional; failures here never block the page.
    try {
      const orgs = await orgApi.list();
      const withEvents = await Promise.all(
        orgs.map(async (org) => ({ org, occasions: await orgApi.occasions(org.id).then((r) => r.occasions).catch(() => []) })),
      );
      setVenues(withEvents);
    } catch {
      setVenues([]);
    }
  }, [t]);

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
              {venues.map(({ org, occasions }) => (
                <View key={org.id} style={{ gap: 10 }}>
                  <View style={styles.venueHead}>
                    {org.logoUrl ? (
                      <Image source={{ uri: org.logoUrl }} style={{ width: 36, height: 36, borderRadius: 10 }} contentFit="contain" accessibilityIgnoresInvertColors />
                    ) : (
                      <View style={[styles.venueDot, { backgroundColor: org.primaryColor ?? colors.blue }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Txt variant="caption" weight="extrabold" muted style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                        {t("venue.title")}
                      </Txt>
                      <Txt weight="extrabold" variant="lead" numberOfLines={1}>
                        {org.name}
                      </Txt>
                    </View>
                  </View>
                  {occasions.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                      {occasions.map((o) => (
                        <CoverCard key={o.id} o={o} compact />
                      ))}
                    </ScrollView>
                  ) : (
                    <Txt variant="small" muted>
                      {t("venue.empty")}
                    </Txt>
                  )}
                </View>
              ))}
              {venues.length && list?.length ? (
                <Txt variant="caption" weight="extrabold" muted style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {t("venue.myEvents")}
                </Txt>
              ) : null}
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
  compact: { width: 260, height: 190 },
  venueHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  venueDot: { width: 36, height: 36, borderRadius: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
});
