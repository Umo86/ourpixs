import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlatList, Modal, StyleSheet, useWindowDimensions, View, type ListViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MediaItem } from "@/api/types";
import { useI18n } from "@/i18n";
import { colors } from "@/theme";
import { IconButton } from "./Button";
import { mediaSource } from "./MediaGrid";
import { Txt } from "./Text";

function VideoPage({ item, active, width, height }: { item: MediaItem; active: boolean; width: number; height: number }) {
  // displayUrl is the poster frame for videos; play the video file itself.
  const uri = item.playbackUrl ?? item.originalUrl ?? null;
  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.loop = false;
  });
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return <VideoView player={player} style={{ width, height }} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />;
}

/** Full-screen swipeable viewer. `renderActions` adds the bottom action row for the current item. */
export function MediaViewer({ items, index, onClose, onIndexChange, renderActions, onEndReached }: {
  items: MediaItem[];
  index: number | null;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
  renderActions?: (item: MediaItem) => ReactNode;
  onEndReached?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [current, setCurrent] = useState(index ?? 0);
  const listRef = useRef<FlatList<MediaItem>>(null);

  useEffect(() => {
    if (index !== null) setCurrent(index);
  }, [index]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) {
      setCurrent(first.index);
      onIndexChange?.(first.index);
    }
  }).current;

  const item = items[current];
  return (
    <Modal visible={index !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent supportedOrientations={["portrait"]}>
      <View style={styles.root}>
        {index !== null ? (
          <FlatList
            ref={listRef}
            data={items}
            horizontal
            pagingEnabled
            initialScrollIndex={Math.min(index, Math.max(items.length - 1, 0))}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(i) => i.id}
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            renderItem={({ item: it, index: i }) => (
              <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
                {it.kind === "video" ? (
                  Math.abs(i - current) <= 1 ? <VideoPage item={it} active={i === current} width={width} height={height * 0.8} /> : null
                ) : (
                  <Image
                    source={mediaSource(it, "display")}
                    placeholder={mediaSource(it, "thumb")}
                    style={{ width, height }}
                    contentFit="contain"
                    transition={120}
                    accessibilityLabel={it.guestName ? t("album.by", { name: it.guestName }) : t("album.anonymous")}
                  />
                )}
              </View>
            )}
          />
        ) : null}

        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="x" label={t("album.closeViewer")} onPress={onClose} variant="glass" />
          <Txt tone="dark" weight="bold" variant="small" accessibilityLiveRegion="polite">
            {t("album.position", { i: current + 1, n: items.length })}
          </Txt>
          <View style={{ width: 44 }} />
        </View>

        {item ? (
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
            <Txt tone="dark" weight="bold">
              {item.guestName ? t("album.by", { name: item.guestName }) : t("album.anonymous")}
            </Txt>
            {item.momentTag ? (
              <Txt tone="dark" variant="small" muted>
                {item.momentTag}
              </Txt>
            ) : null}
            {renderActions ? <View style={styles.actions}>{renderActions(item)}</View> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  top: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 16, gap: 4, backgroundColor: "rgba(10,10,10,0.6)" },
  actions: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
});
