import { BodoniModa_400Regular_Italic } from "@expo-google-fonts/bodoni-moda/400Regular_Italic";
import { InterTight_400Regular } from "@expo-google-fonts/inter-tight/400Regular";
import { InterTight_500Medium } from "@expo-google-fonts/inter-tight/500Medium";
import { InterTight_600SemiBold } from "@expo-google-fonts/inter-tight/600SemiBold";
import { InterTight_700Bold } from "@expo-google-fonts/inter-tight/700Bold";
import { InterTight_800ExtraBold } from "@expo-google-fonts/inter-tight/800ExtraBold";
import { InterTight_900Black } from "@expo-google-fonts/inter-tight/900Black";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { authApi, setApiLocale } from "@/api/client";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { I18nProvider, onLocaleChange, useI18n } from "@/i18n";
import { configureNotificationHandler } from "@/lib/push";
import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotificationHandler();

/** Keeps the API Accept-Language in sync and saves explicit language changes to the host profile. */
function LocaleSync() {
  const { locale } = useI18n();
  const { token, setHost } = useAuth();
  useEffect(() => setApiLocale(locale), [locale]);
  useEffect(
    () =>
      onLocaleChange((l) => {
        if (token) authApi.updateMe({ locale: l }).then(({ host }) => setHost(host)).catch(() => undefined);
      }),
    [token, setHost],
  );
  return null;
}

/** Opens the event when a push notification is tapped. Expected payload: { occasionId } or { slug }. */
function NotificationRouting() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const open = (data: Record<string, unknown> | undefined) => {
      if (typeof data?.occasionId === "string") router.push({ pathname: "/host/[id]", params: { id: data.occasionId } });
      else if (typeof data?.slug === "string") router.push({ pathname: "/g/[slug]", params: { slug: data.slug } });
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data as Record<string, unknown>);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data as Record<string, unknown>));
    return () => sub.remove();
  }, []);
  return null;
}

function Gate({ children }: { children: React.ReactNode }) {
  const { ready: authReady } = useAuth();
  const { ready: i18nReady } = useI18n();
  const ready = authReady && i18nReady;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold, InterTight_700Bold, InterTight_800ExtraBold, InterTight_900Black,
    BodoniModa_400Regular_Italic,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <Gate>
            <LocaleSync />
            <NotificationRouting />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white }, animation: "slide_from_right" }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="host" />
              <Stack.Screen name="join/index" options={{ contentStyle: { backgroundColor: colors.black } }} />
              <Stack.Screen name="join/[slug]" options={{ contentStyle: { backgroundColor: colors.black } }} />
              <Stack.Screen name="g/[slug]" options={{ contentStyle: { backgroundColor: colors.black } }} />
              <Stack.Screen name="demo/[screen]" options={{ animation: "none" }} />
            </Stack>
          </Gate>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
