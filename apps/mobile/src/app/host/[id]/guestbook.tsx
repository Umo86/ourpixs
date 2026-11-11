import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { errorMessage, hostApi } from "@/api/client";
import type { Message } from "@/api/types";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { formatDuration } from "@/components/MediaGrid";
import { Screen } from "@/components/Screen";
import { EmptyState, ErrorView, Loading } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { useOccasion } from "@/host/OccasionContext";
import { useI18n } from "@/i18n";
import { formatRelative } from "@/lib/format";
import { colors } from "@/theme";

function VoiceRow({ m }: { m: Message }) {
  const { t } = useI18n();
  const player = useAudioPlayer(m.mediaUrl ? { uri: m.mediaUrl } : null);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Button
        full={false}
        size="sm"
        icon={playing ? "pause" : "play"}
        label={playing ? t("guestbook.pause") : t("guestbook.play")}
        disabled={!m.mediaUrl}
        onPress={() => {
          if (playing) player.pause();
          else {
            if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) void player.seekTo(0);
            player.play();
          }
        }}
      />
      <Txt variant="small" muted>
        {t("guestbook.voice")} · {formatDuration(m.durationS)}
      </Txt>
    </View>
  );
}

function VideoRow({ m }: { m: Message }) {
  const player = useVideoPlayer(m.mediaUrl ? { uri: m.mediaUrl } : null);
  useEffect(() => () => player.pause(), [player]);
  if (!m.mediaUrl) return null;
  return <VideoView player={player} style={{ width: "100%", aspectRatio: 9 / 16, maxHeight: 420, borderRadius: 20, backgroundColor: colors.black }} contentFit="contain" nativeControls />;
}

export default function HostGuestbook() {
  const { t, locale } = useI18n();
  const { id, occasion } = useOccasion();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await hostApi.messages(id);
      setMessages(res.messages);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [id, t]);
  useEffect(() => void load(), [load]);

  return (
    <Screen header={<AppHeader tone="light" back={() => router.replace("/host")} title={occasion?.title} />} bottomInset={false} contentStyle={{ paddingBottom: 0 }}>
      {messages === null && !error ? (
        <Loading />
      ) : error && !messages ? (
        <ErrorView message={error} onRetry={load} />
      ) : (
        <FlatList
          data={messages ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.blue} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListHeaderComponent={
            <Heading size="lg" accent={t("guestbook.accent")} style={{ marginBottom: 8 }}>
              {t("guestbook.title")}
            </Heading>
          }
          ListEmptyComponent={<EmptyState icon="book" title={t("guestbook.empty")} body={t("guestbook.emptyBody")} />}
          renderItem={({ item: m }) => (
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" }}>
                  {m.guestName ? (
                    <Txt weight="extrabold" color={colors.white}>
                      {m.guestName.trim().charAt(0).toLocaleUpperCase(locale)}
                    </Txt>
                  ) : (
                    <Icon name="users" size={16} color={colors.white} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold">{m.guestName ?? t("album.anonymous")}</Txt>
                  <Txt variant="caption" muted>
                    {formatRelative(m.createdAt, locale)}
                  </Txt>
                </View>
                <Icon name={m.kind === "voice" ? "mic" : m.kind === "video" ? "video" : "message"} size={18} color={colors.blue} />
              </View>
              {m.body ? <Txt variant="lead">{m.body}</Txt> : null}
              {m.kind === "voice" ? <VoiceRow m={m} /> : null}
              {m.kind === "video" ? <VideoRow m={m} /> : null}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
