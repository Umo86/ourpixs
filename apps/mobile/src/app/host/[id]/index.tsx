import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, View } from "react-native";

import { errorMessage, hostApi } from "@/api/client";
import type { MediaAction, MediaItem, MediaQuery } from "@/api/types";
import { AppHeader } from "@/components/AppHeader";
import { Button, IconButton } from "@/components/Button";
import { Chip } from "@/components/Form";
import { MediaGrid } from "@/components/MediaGrid";
import { MediaViewer } from "@/components/MediaViewer";
import { Screen } from "@/components/Screen";
import { EmptyState, ErrorView, Loading, Notice } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { useOccasion } from "@/host/OccasionContext";
import { useI18n } from "@/i18n";
import { formatNumber } from "@/lib/format";
import { DownloadLockedError, PermissionDeniedError, saveToCameraRoll } from "@/lib/saveMedia";
import { accessNoticeKey, packageLine } from "@/components/PackageStatus";
import { onUploadCompleted } from "@/upload/queue";
import { colors, radius } from "@/theme";

type FilterKey = "all" | "photo" | "video" | "favourites" | "hidden" | "pending";

export default function Album() {
  const { t, locale } = useI18n();
  const { id, occasion, stats, error: occErr, refresh: refreshOcc } = useOccasion();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [dayId, setDayId] = useState<string | null>(null);
  const [moment, setMoment] = useState<string | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [knownMoments, setKnownMoments] = useState<string[]>([]);
  const reqId = useRef(0);

  const query = useMemo<MediaQuery>(() => {
    const q: MediaQuery = {};
    if (filter === "photo" || filter === "video") q.kind = filter;
    if (filter === "favourites" || filter === "hidden" || filter === "pending") q.filter = filter;
    if (dayId) q.dayId = dayId;
    if (moment) q.moment = moment;
    return q;
  }, [filter, dayId, moment]);

  const load = useCallback(
    async (reset: boolean) => {
      const my = ++reqId.current;
      if (reset) setLoading(true);
      try {
        const res = await hostApi.media(id, { ...query, cursor: reset ? null : cursor });
        if (my !== reqId.current) return;
        setItems((prev) => (reset ? res.items : [...prev, ...res.items.filter((n) => !prev.some((p) => p.id === n.id))]));
        setCursor(res.nextCursor);
        setError(null);
        // Moment filter options come from the tags actually used in this album.
        setKnownMoments((prev) => {
          const set = new Set(prev);
          for (const it of res.items) if (it.momentTag) set.add(it.momentTag);
          return set.size === prev.length ? prev : [...set];
        });
      } catch (e) {
        if (my === reqId.current) setError(errorMessage(e, t));
      } finally {
        if (my === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [id, query, cursor, t],
  );

  useEffect(() => {
    setSelected(new Set());
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, query]);

  useEffect(() => onUploadCompleted((key) => key === `host:${id}` && void load(true)), [id, load]);

  const loadMore = () => {
    if (!cursor || loadingMore || loading) return;
    setLoadingMore(true);
    void load(false);
  };

  const toggle = (it: MediaItem) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(it.id)) n.delete(it.id);
      else n.add(it.id);
      return n;
    });

  const applyLocal = (ids: string[], action: MediaAction) => {
    setItems((prev) =>
      prev
        .filter((it) => !(action === "delete" && ids.includes(it.id)))
        .filter((it) => !(ids.includes(it.id) && ((filter === "hidden" && action === "show") || (filter === "favourites" && action === "unfavourite") || (filter === "pending" && action === "approve"))))
        .map((it) => {
          if (!ids.includes(it.id)) return it;
          switch (action) {
            case "favourite": return { ...it, favourite: true };
            case "unfavourite": return { ...it, favourite: false };
            case "hide": return { ...it, visibility: "hidden" };
            case "show": return { ...it, visibility: "visible" };
            case "approve": return { ...it, approved: true };
            default: return it;
          }
        }),
    );
  };

  // App Store 1.2: hosts can block an abusive guest (hides all their uploads, stops that device uploading).
  const blockGuest = (it: MediaItem) =>
    Alert.alert(t("album.blockGuestTitle", { name: it.guestName ?? t("album.blockGuestUnknown") }), t("album.blockGuestBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("album.blockGuest"),
        style: "destructive",
        onPress: async () => {
          if (!it.guestId) return;
          setBusy(true);
          try {
            await hostApi.blockGuest(id, it.guestId);
            setItems((prev) => (filter === "hidden" ? prev : prev.filter((m) => m.guestId !== it.guestId)));
            setViewer(null);
            void refreshOcc();
          } catch (e) {
            Alert.alert(errorMessage(e, t));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const act = async (ids: string[], action: MediaAction) => {
    if (!ids.length) return;
    const run = async () => {
      setBusy(true);
      try {
        await hostApi.mediaAction(id, ids, action);
        applyLocal(ids, action);
        setSelected(new Set());
        if (action === "delete" || action === "approve") void refreshOcc();
        if (action === "delete") setViewer(null);
      } catch (e) {
        Alert.alert(errorMessage(e, t));
      } finally {
        setBusy(false);
      }
    };
    if (action === "delete") {
      Alert.alert(t("album.deleteTitle", { n: ids.length }), t("album.deleteBody"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.delete"), style: "destructive", onPress: () => void run() },
      ]);
    } else await run();
  };

  const save = async (list: MediaItem[]) => {
    // Downloads follow the event package (not before it's paid). Neutral message, no purchase prompt (App Store 3.1.1).
    if (occasion?.access && !occasion.access.canDownload) return Alert.alert(t("errors.paymentRequired"));
    setBusy(true);
    try {
      const n = await saveToCameraRoll(list, async (it) => (await hostApi.downloadUrl(id, it.id)).url);
      Alert.alert(n === 1 ? t("album.saved") : t("album.savedN", { n }));
      setSelected(new Set());
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        Alert.alert(t("errors.permissionPhotos"), undefined, [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("errors.openSettings"), onPress: () => void Linking.openSettings() },
        ]);
      } else if (e instanceof DownloadLockedError) Alert.alert(t("errors.paymentRequired"));
      else Alert.alert(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  const selItems = items.filter((i) => selected.has(i.id));
  const allFav = selItems.length > 0 && selItems.every((i) => i.favourite);
  const allHidden = selItems.length > 0 && selItems.every((i) => i.visibility === "hidden");
  const anyPending = selItems.some((i) => i.approved === false);
  const accessKey = accessNoticeKey(occasion?.access);
  const showPending = !!occasion?.approvalMode || (stats?.pendingApproval ?? 0) > 0;

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: t("album.all") },
    { key: "photo", label: t("album.photos") },
    { key: "video", label: t("album.videos") },
    { key: "favourites", label: t("album.favourites") },
    { key: "hidden", label: t("album.hidden") },
    ...(showPending ? [{ key: "pending" as const, label: `${t("album.pending")}${stats?.pendingApproval ? ` · ${stats.pendingApproval}` : ""}` }] : []),
  ];

  const header = (
    <AppHeader
      tone="light"
      back={() => router.replace("/host")}
      title={occasion?.title}
      right={selected.size > 0 ? <IconButton icon="x" label={t("common.cancel")} onPress={() => setSelected(new Set())} /> : undefined}
    />
  );

  if (occErr && !occasion) return <Screen header={header} bottomInset={false}><ErrorView message={errorMessage(occErr, t)} onRetry={refreshOcc} /></Screen>;

  const listHeader = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      <Heading size="md" accent={t("album.headingAccent")}>
        {formatNumber((stats?.photos ?? 0) + (stats?.videos ?? 0), locale)}
      </Heading>
      {occasion ? <Txt variant="small" weight="bold" muted>{packageLine(occasion, t, locale).label}</Txt> : null}
      {accessKey ? <Notice icon={occasion?.access.readOnly ? "lock" : "sparkles"} text={t(accessKey, { n: occasion?.package?.testUploadLimit ?? 20 })} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {filters.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>
      {occasion && occasion.days.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={t("album.allDays")} selected={!dayId} onPress={() => setDayId(null)} />
          {occasion.days.map((d) => (
            <Chip key={d.id} label={d.name} selected={dayId === d.id} onPress={() => setDayId(d.id)} />
          ))}
        </ScrollView>
      ) : null}
      {knownMoments.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {knownMoments.map((m) => (
            <Chip key={m} label={m} selected={moment === m} onPress={() => setMoment(moment === m ? null : m)} />
          ))}
        </ScrollView>
      ) : null}
      {items.length > 0 && selected.size === 0 ? (
        <Txt variant="caption" muted>
          {t("album.selectHint")}
        </Txt>
      ) : null}
    </View>
  );

  return (
    <Screen header={header} bottomInset={false} contentStyle={{ paddingBottom: 0 }}>
      {loading && items.length === 0 ? (
        <>
          <View style={{ paddingHorizontal: 16 }}>{listHeader}</View>
          <Loading />
        </>
      ) : error && items.length === 0 ? (
        <ErrorView message={error} onRetry={() => void load(true)} />
      ) : (
        <MediaGrid
          items={items}
          onPress={(i) => setViewer(i)}
          onLongPress={toggle}
          selected={selected}
          onEndReached={loadMore}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await Promise.all([load(true), refreshOcc()]);
            setRefreshing(false);
          }}
          header={listHeader}
          empty={<EmptyState icon="image" title={t("album.empty")} body={t("album.emptyBody")} action={{ label: t("host.tabs.qr"), onPress: () => router.navigate({ pathname: "/host/[id]/qr", params: { id } }) }} />}
          footer={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.blue} /> : null}
          bottomPadding={selected.size > 0 ? 120 : 24}
        />
      )}

      {selected.size > 0 ? (
        <View style={[styles.actionBar, { bottom: 12 }]} accessibilityRole="toolbar">
          <Txt weight="extrabold" color={colors.white} style={{ paddingHorizontal: 6 }} accessibilityLiveRegion="polite">
            {t("common.selected", { n: selected.size })}
          </Txt>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <IconButton icon="star" label={allFav ? t("album.unfavourite") : t("album.favourite")} variant="glass" disabled={busy} onPress={() => void act([...selected], allFav ? "unfavourite" : "favourite")} active={allFav} />
            <IconButton icon={allHidden ? "eye" : "eyeOff"} label={allHidden ? t("album.show") : t("album.hide")} variant="glass" disabled={busy} onPress={() => void act([...selected], allHidden ? "show" : "hide")} />
            {anyPending ? <IconButton icon="check" label={t("album.approve")} variant="primary" disabled={busy} onPress={() => void act([...selected], "approve")} /> : null}
            <IconButton icon="download" label={t("album.saveToPhotos")} variant="glass" disabled={busy} onPress={() => void save(selItems)} />
            <IconButton icon="trash" label={t("common.delete")} variant="glass" disabled={busy} onPress={() => void act([...selected], "delete")} />
          </View>
        </View>
      ) : null}

      <MediaViewer
        items={items}
        index={viewer}
        onClose={() => setViewer(null)}
        onEndReached={loadMore}
        renderActions={(it) => (
          <>
            <Button size="sm" full={false} tone="dark" variant={it.favourite ? "primary" : "secondary"} icon="star" label={it.favourite ? t("album.unfavourite") : t("album.favourite")} onPress={() => void act([it.id], it.favourite ? "unfavourite" : "favourite")} />
            <Button size="sm" full={false} tone="dark" variant="secondary" icon="download" label={t("album.saveToPhotos")} onPress={() => void save([it])} />
            {it.approved === false ? <Button size="sm" full={false} tone="dark" icon="check" label={t("album.approve")} onPress={() => void act([it.id], "approve")} /> : null}
            <Button size="sm" full={false} tone="dark" variant="secondary" icon={it.visibility === "hidden" ? "eye" : "eyeOff"} label={it.visibility === "hidden" ? t("album.show") : t("album.hide")} onPress={() => void act([it.id], it.visibility === "hidden" ? "show" : "hide")} />
            <Button size="sm" full={false} tone="dark" variant="danger" icon="trash" label={t("common.delete")} onPress={() => void act([it.id], "delete")} />
            {it.guestId ? <Button size="sm" full={false} tone="dark" variant="ghost" icon="alert" label={t("album.blockGuest")} onPress={() => blockGuest(it)} /> : null}
          </>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingRight: 16 },
  actionBar: {
    position: "absolute", left: 12, right: 12, backgroundColor: colors.black, borderRadius: radius.pill, padding: 8, paddingLeft: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
});
