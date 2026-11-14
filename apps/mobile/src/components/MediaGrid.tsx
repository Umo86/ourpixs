import { Image } from "expo-image";
import type { ReactElement } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from "react-native";

import type { MediaItem } from "@/api/types";
import { useI18n } from "@/i18n";
import { colors, fonts, palette, type Tone } from "@/theme";
import { Icon } from "./Icon";
import { Txt } from "./Text";

const GAP = 4;
const H_PAD = 16;

export function formatDuration(s: number | null | undefined): string {
  if (!s && s !== 0) return "";
  const m = Math.floor(s / 60);
  const ss = Math.round(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export function mediaSource(item: MediaItem, which: "thumb" | "display") {
  const uri = which === "thumb" ? item.thumbUrl ?? item.displayUrl : item.displayUrl ?? item.thumbUrl;
  // Signed URLs change hourly; cache by media id so the image cache survives re-signing.
  return uri ? { uri, cacheKey: `${item.id}-${which}` } : null;
}

/** 3-column grid with infinite scroll, long-press multi-select and status badges. */
export function MediaGrid({
  items, tone = "light", onPress, onLongPress, selected, onEndReached, refreshing = false, onRefresh, header, empty, footer, bottomPadding = 24,
}: {
  items: MediaItem[];
  tone?: Tone;
  onPress: (index: number) => void;
  onLongPress?: (item: MediaItem) => void;
  selected?: Set<string>;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: ReactElement | null;
  empty?: ReactElement | null;
  footer?: ReactElement | null;
  bottomPadding?: number;
}) {
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const size = Math.floor((width - H_PAD * 2 - GAP * 2) / 3);
  const p = palette(tone);
  const selecting = !!selected && selected.size > 0;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      numColumns={3}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ paddingHorizontal: H_PAD, gap: GAP, paddingBottom: bottomPadding, flexGrow: 1 }}
      ListHeaderComponent={header ?? undefined}
      ListEmptyComponent={empty ?? undefined}
      ListFooterComponent={footer ?? undefined}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      removeClippedSubviews
      initialNumToRender={24}
      windowSize={9}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tone === "dark" ? colors.white : colors.blue} /> : undefined}
      renderItem={({ item, index }) => {
        const isSel = selected?.has(item.id) ?? false;
        const src = mediaSource(item, "thumb");
        const label = [
          item.kind === "video" ? t("common.videos") : t("common.photos"),
          item.guestName ? t("album.by", { name: item.guestName }) : null,
          isSel ? t("common.selected", { n: 1 }) : null,
        ].filter(Boolean).join(", ");
        return (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={label}
            accessibilityState={{ selected: isSel }}
            onPress={() => (selecting && onLongPress ? onLongPress(item) : onPress(index))}
            onLongPress={onLongPress ? () => onLongPress(item) : undefined}
            delayLongPress={280}
            style={({ pressed }) => [{ width: size, height: size, borderRadius: 14, overflow: "hidden", backgroundColor: p.surface2, opacity: pressed ? 0.85 : 1 }]}
          >
            {src ? (
              <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={item.id} cachePolicy="memory-disk" />
            ) : (
              // Copies still being made (`processing: "pending"`), or no preview could be made ("failed"). Never a fallback URL.
              <View style={[StyleSheet.absoluteFill, styles.processing]} accessibilityLabel={item.processing === "failed" ? t("album.unavailable") : t("album.processing")}>
                <Icon name={item.processing === "failed" ? "image" : "clock"} size={20} color={p.muted} />
                <Txt style={[styles.processingText, { color: p.muted }]} numberOfLines={2}>
                  {item.processing === "failed" ? t("album.unavailable") : t("album.processing")}
                </Txt>
              </View>
            )}
            {item.kind === "video" ? (
              <View style={styles.badge}>
                <Icon name="play" size={11} color={colors.white} fill={colors.white} />
                <Txt style={styles.badgeText}>{formatDuration(item.durationS)}</Txt>
              </View>
            ) : null}
            {item.favourite ? (
              <View style={[styles.corner, { right: 6, top: 6 }]}>
                <Icon name="star" size={14} color={colors.white} fill={colors.white} />
              </View>
            ) : null}
            {item.visibility === "hidden" || item.approved === false ? (
              <View style={[StyleSheet.absoluteFill, styles.dim]}>
                <Icon name={item.approved === false ? "lock" : "eyeOff"} size={20} color={colors.white} />
              </View>
            ) : null}
            {isSel ? (
              <View style={[StyleSheet.absoluteFill, styles.selected]}>
                <View style={styles.check}>
                  <Icon name="check" size={14} color={colors.white} strokeWidth={3} />
                </View>
              </View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  badge: { position: "absolute", left: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(10,10,10,0.65)", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  corner: { position: "absolute", backgroundColor: colors.blue, borderRadius: 999, padding: 4 },
  processing: { alignItems: "center", justifyContent: "center", gap: 4, padding: 6 },
  processingText: { fontFamily: fonts.bold, fontSize: 11, textAlign: "center" },
  dim: { backgroundColor: "rgba(10,10,10,0.55)", alignItems: "center", justifyContent: "center" },
  selected: { borderWidth: 3, borderColor: colors.blue, borderRadius: 14, backgroundColor: "rgba(35,71,224,0.25)" },
  check: { position: "absolute", right: 6, top: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
});
