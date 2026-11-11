import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, View } from "react-native";

import { errorMessage, guestApi } from "@/api/client";
import type { MediaItem } from "@/api/types";
import { GuestHeader } from "@/components/EventBrand";
import { Button, IconButton } from "@/components/Button";
import { Pill } from "@/components/Card";
import { TitleWithAmp } from "@/components/EventTitle";
import { Chip } from "@/components/Form";
import { MediaGrid } from "@/components/MediaGrid";
import { MediaViewer } from "@/components/MediaViewer";
import { Screen } from "@/components/Screen";
import { EmptyState, ErrorView, Loading, Notice } from "@/components/States";
import { occasionLabel, supportEmail } from "@/config";
import { useGuest } from "@/guest/GuestContext";
import { useI18n } from "@/i18n";
import { PermissionDeniedError, saveToCameraRoll } from "@/lib/saveMedia";
import { onUploadCompleted } from "@/upload/queue";
import { colors } from "@/theme";

const POLL_MS = 20_000;

export default function GuestFeed() {
  const { t, locale, brand } = useI18n();
  const { slug, session, auth, occasion, leave, expired } = useGuest();
  const [mode, setMode] = useState<"all" | "mine">("all");
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const newest = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (mode === "mine") {
        const res = await guestApi.mine(slug, auth);
        setItems(res.items);
        setCursor(null);
      } else {
        const res = await guestApi.feed(slug, auth);
        setItems(res.items);
        setCursor(res.nextCursor);
        newest.current = res.items[0]?.createdAt ?? null;
      }
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [slug, auth, mode, t]);

  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  // Live: poll for new uploads and prepend them.
  useEffect(() => {
    if (mode !== "all") return;
    const timer = setInterval(async () => {
      if (!newest.current) return;
      try {
        const res = await guestApi.feed(slug, auth, { after: newest.current });
        if (res.items.length) {
          setItems((prev) => [...res.items.filter((n) => !(prev ?? []).some((p) => p.id === n.id)), ...(prev ?? [])]);
          newest.current = res.items[0].createdAt;
        }
      } catch {
        // stay quiet while polling
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [slug, auth, mode]);

  useEffect(() => onUploadCompleted((key) => key === `guest:${slug}` && void load()), [slug, load]);

  const loadMore = async () => {
    if (!cursor || loadingMore || mode !== "all") return;
    setLoadingMore(true);
    try {
      const res = await guestApi.feed(slug, auth, { cursor });
      setItems((prev) => [...(prev ?? []), ...res.items.filter((n) => !(prev ?? []).some((p) => p.id === n.id))]);
      setCursor(res.nextCursor);
    } catch {
      // retry on next scroll
    } finally {
      setLoadingMore(false);
    }
  };

  const react = async (it: MediaItem) => {
    // optimistic toggle
    const flip = (m: MediaItem, reacted: boolean, count: number) => (m.id === it.id ? { ...m, reactedByMe: reacted, reactionCount: count } : m);
    const wasOn = !!it.reactedByMe;
    setItems((prev) => prev?.map((m) => flip(m, !wasOn, m.reactionCount + (wasOn ? -1 : 1))) ?? prev);
    try {
      const res = await guestApi.react(slug, auth, it.id);
      setItems((prev) => prev?.map((m) => flip(m, res.reacted, res.count)) ?? prev);
    } catch {
      setItems((prev) => prev?.map((m) => flip(m, wasOn, it.reactionCount)) ?? prev);
    }
  };

  const save = async (it: MediaItem) => {
    try {
      await saveToCameraRoll([it]);
      Alert.alert(t("album.saved"));
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        Alert.alert(t("errors.permissionPhotos"), undefined, [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("errors.openSettings"), onPress: () => void Linking.openSettings() },
        ]);
      } else Alert.alert(t("errors.generic"));
    }
  };

  const deleteMine = (it: MediaItem) =>
    Alert.alert(t("guest.deleteMineTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await guestApi.deleteMine(slug, auth, it.id);
            setItems((prev) => prev?.filter((m) => m.id !== it.id) ?? prev);
            setViewer(null);
          } catch (e) {
            Alert.alert(errorMessage(e, t));
          }
        },
      },
    ]);

  // App Store 1.2: guests can report objectionable content to us; hosts can hide/delete it in their album.
  const report = (it: MediaItem) => {
    const subject = encodeURIComponent(t("guest.reportSubject"));
    const body = encodeURIComponent(t("guest.reportBody", { slug, id: it.id }));
    void Linking.openURL(`mailto:${supportEmail(brand)}?subject=${subject}&body=${body}`);
  };

  const doLeave = () =>
    Alert.alert(t("guest.leave"), occasion?.title, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("guest.leave"),
        style: "destructive",
        onPress: async () => {
          await leave();
          router.replace("/");
        },
      },
    ]);

  const dayLabel = occasion ? occasionLabel(occasion.type, locale) : "";
  const header = (
    <GuestHeader
      occasion={occasion}
      title={`${t("guest.hi", { name: session.name })}${dayLabel ? ` · ${dayLabel}` : ""}`}
      right={
        <>
          <Pill text={t("guest.live")} variant="surface" tone="dark" />
          <IconButton icon="logOut" label={t("guest.leave")} tone="dark" onPress={doLeave} />
        </>
      }
    />
  );

  if (expired) {
    return (
      <Screen tone="dark" header={header} bottomInset={false}>
        <ErrorView tone="dark" message={t("errors.session")} onRetry={() => router.replace({ pathname: "/join/[slug]", params: { slug } })} />
      </Screen>
    );
  }

  const listHeader = (
    <View style={{ gap: 14, paddingBottom: 10 }}>
      {occasion ? <TitleWithAmp title={occasion.title} size="lg" /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip tone="dark" label={t("album.all")} selected={mode === "all"} onPress={() => setMode("all")} />
        <Chip tone="dark" label={t("guest.mine")} selected={mode === "mine"} onPress={() => setMode("mine")} />
      </ScrollView>
      {occasion?.revealMode === "next_morning" && mode === "all" ? (
        <Notice tone="dark" icon="sparkles" text={t("guest.revealLater", { when: t("guest.revealMorning") })} />
      ) : null}
    </View>
  );

  return (
    <Screen tone="dark" header={header} bottomInset={false} contentStyle={{ paddingBottom: 0 }}>
      {items === null && !error ? (
        <Loading tone="dark" />
      ) : error && !items ? (
        <ErrorView tone="dark" message={error} onRetry={load} />
      ) : (
        <MediaGrid
          tone="dark"
          items={items ?? []}
          onPress={(i) => setViewer(i)}
          onEndReached={loadMore}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          header={listHeader}
          empty={
            <EmptyState
              tone="dark"
              icon="camera"
              title={t("guest.feedEmpty")}
              body={t("guest.feedEmptyBody")}
              action={{ label: t("upload.pick"), onPress: () => router.navigate({ pathname: "/g/[slug]/upload", params: { slug } }) }}
            />
          }
          footer={loadingMore ? <ActivityIndicator color={colors.white} style={{ margin: 16 }} /> : null}
        />
      )}

      <MediaViewer
        items={items ?? []}
        index={viewer}
        onClose={() => setViewer(null)}
        onEndReached={loadMore}
        renderActions={(it) => (
          <>
            <Button
              size="sm"
              full={false}
              tone="dark"
              variant={it.reactedByMe ? "primary" : "secondary"}
              icon="heart"
              label={`${it.reactionCount}`}
              accessibilityLabel={it.reactedByMe ? t("guest.unlike") : t("guest.like")}
              onPress={() => void react(it)}
            />
            <Button size="sm" full={false} tone="dark" variant="secondary" icon="download" label={t("common.download")} onPress={() => void save(it)} />
            {mode === "mine" ? (
              <Button size="sm" full={false} tone="dark" variant="danger" icon="trash" label={t("guest.deleteMine")} onPress={() => deleteMine(it)} />
            ) : (
              <Button size="sm" full={false} tone="dark" variant="ghost" icon="alert" label={t("guest.report")} onPress={() => report(it)} />
            )}
          </>
        )}
      />
    </Screen>
  );
}
