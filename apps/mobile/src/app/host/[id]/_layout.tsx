import { useLocalSearchParams } from "expo-router";
import { Tabs } from "expo-router/js-tabs";

import { HostTabBar, type TabSpec } from "@/components/TabBars";
import { OccasionProvider } from "@/host/OccasionContext";
import { useI18n } from "@/i18n";

/** Event detail: one host tab bar style for every event screen. */
export default function OccasionLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const specs: Record<string, TabSpec> = {
    index: { icon: "image", label: t("host.tabs.album") },
    upload: { icon: "upload", label: t("host.tabs.upload") },
    qr: { icon: "qr", label: t("host.tabs.qr") },
    guestbook: { icon: "book", label: t("host.tabs.guestbook") },
    missions: { icon: "target", label: t("host.tabs.missions") },
    wall: { icon: "tv", label: t("host.tabs.wall") },
    settings: { icon: "settings", label: t("host.tabs.settings") },
  };
  return (
    <OccasionProvider id={String(id)}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <HostTabBar {...props} specs={specs} />}>
        <Tabs.Screen name="index" options={{ title: specs.index.label }} />
        <Tabs.Screen name="upload" options={{ title: specs.upload.label }} />
        <Tabs.Screen name="qr" options={{ title: specs.qr.label }} />
        <Tabs.Screen name="guestbook" options={{ title: specs.guestbook.label }} />
        <Tabs.Screen name="missions" options={{ title: specs.missions.label }} />
        <Tabs.Screen name="wall" options={{ title: specs.wall.label }} />
        <Tabs.Screen name="settings" options={{ title: specs.settings.label }} />
      </Tabs>
    </OccasionProvider>
  );
}
