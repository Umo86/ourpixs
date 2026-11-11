import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { VideoAirPlayButton } from "expo-video";
import { useState } from "react";
import { Platform, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { openSite } from "@/components/Footer";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Loading } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { useOccasion } from "@/host/OccasionContext";
import { useI18n } from "@/i18n";
import { colors } from "@/theme";

export default function HostWall() {
  const { t } = useI18n();
  const { id, occasion } = useOccasion();
  const [copied, setCopied] = useState(false);

  return (
    <Screen header={<AppHeader tone="light" back={() => router.replace("/host")} title={occasion?.title} />} scroll={!!occasion} bottomInset={false}>
      {!occasion ? (
        <Loading />
      ) : (
        <>
          <Heading size="lg" accent={t("wall.accent")}>
            {t("wall.title")}
          </Heading>
          <Txt muted>{t("wall.body")}</Txt>

          <Card tone="dark" style={{ backgroundColor: colors.black, height: 190, justifyContent: "flex-end", gap: 8 }}>
            <Icon name="tv" size={30} color={colors.blueOnDarkSoft} />
            <Heading tone="dark" size="sm" numberOfLines={2}>
              {occasion.title}
            </Heading>
            <Txt tone="dark" variant="caption" muted numberOfLines={1}>
              {occasion.wallUrl}
            </Txt>
          </Card>

          <Button label={t("wall.open")} icon="external" onPress={() => openSite(occasion.wallUrl)} />
          <Button
            label={copied ? t("common.copied") : t("wall.copy")}
            icon={copied ? "check" : "copy"}
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(occasion.wallUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          />

          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Txt weight="extrabold" style={{ flex: 1 }}>
                {t("wall.cast")}
              </Txt>
              {Platform.OS === "ios" ? (
                <VideoAirPlayButton style={{ width: 44, height: 44 }} tint={colors.black} activeTint={colors.blue} accessibilityLabel={t("wall.cast")} />
              ) : null}
            </View>
            <Txt variant="small" muted>
              {Platform.OS === "ios" ? t("wall.airplay") : t("wall.android")}
            </Txt>
          </Card>
        </>
      )}
    </Screen>
  );
}
