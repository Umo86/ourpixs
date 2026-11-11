import { Redirect, useLocalSearchParams } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { GuestTabBar, type TabSpec } from "@/components/TabBars";
import { DEMO_MODE } from "@/config";
import { DEMO_GUEST_TOKEN } from "@/demo/data";
import { GuestProvider } from "@/guest/GuestContext";
import { useI18n } from "@/i18n";
import { getGuestSession, type GuestSession } from "@/lib/guestSessions";
import { colors } from "@/theme";

/**
 * Guest area for one event (also the target of https://ourpixs.com/g/<slug> universal links).
 * No stored guest token → the join screen.
 */
export default function GuestLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useI18n();
  const [session, setSession] = useState<GuestSession | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void getGuestSession(String(slug)).then((s) => {
      if (!alive) return;
      if (!s && DEMO_MODE) {
        setSession({ slug: String(slug), token: DEMO_GUEST_TOKEN, guestId: "demo-guest", name: "Ayşe", title: "Elif & Can", joinedAt: new Date().toISOString() });
      } else setSession(s);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (session === undefined) return <View style={{ flex: 1, backgroundColor: colors.black }} />;
  if (session === null) return <Redirect href={{ pathname: "/join/[slug]", params: { slug: String(slug) } }} />;

  const specs: Record<string, TabSpec> = {
    index: { icon: "image", label: t("guest.tabs.feed") },
    upload: { icon: "camera", label: t("guest.tabs.upload") },
    missions: { icon: "target", label: t("guest.tabs.missions") },
    guestbook: { icon: "book", label: t("guest.tabs.guestbook") },
  };

  return (
    <GuestProvider session={session}>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.black } }} tabBar={(props) => <GuestTabBar {...props} specs={specs} />}>
        <Tabs.Screen name="index" options={{ title: specs.index.label }} />
        <Tabs.Screen name="upload" options={{ title: specs.upload.label }} />
        <Tabs.Screen name="missions" options={{ title: specs.missions.label }} />
        <Tabs.Screen name="guestbook" options={{ title: specs.guestbook.label }} />
      </Tabs>
    </GuestProvider>
  );
}
