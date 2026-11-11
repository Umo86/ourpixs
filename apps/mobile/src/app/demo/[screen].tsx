import { Redirect, router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { DEMO_MODE } from "@/config";
import { DEMO_ID, DEMO_SLUG, demoHost } from "@/demo/data";
import { useI18n } from "@/i18n";
import { colors } from "@/theme";

/**
 * Demo deep links for store screenshots (only when EXPO_PUBLIC_DEMO=1):
 *   bizimresimler://demo/<screen>?lang=en|tr        (native)
 *   http://localhost:8081/demo/<screen>?lang=tr (web export, Playwright)
 */
const TARGETS: Record<string, { href: Href; host?: boolean }> = {
  welcome: { href: "/" },
  login: { href: "/login" },
  home: { href: "/host", host: true },
  new: { href: "/host/new", host: true },
  created: { href: { pathname: "/host/new", params: { step: "created" } }, host: true },
  album: { href: { pathname: "/host/[id]", params: { id: DEMO_ID } }, host: true },
  upload: { href: { pathname: "/host/[id]/upload", params: { id: DEMO_ID } }, host: true },
  qr: { href: { pathname: "/host/[id]/qr", params: { id: DEMO_ID } }, host: true },
  guestbook: { href: { pathname: "/host/[id]/guestbook", params: { id: DEMO_ID } }, host: true },
  missions: { href: { pathname: "/host/[id]/missions", params: { id: DEMO_ID } }, host: true },
  wall: { href: { pathname: "/host/[id]/wall", params: { id: DEMO_ID } }, host: true },
  settings: { href: { pathname: "/host/[id]/settings", params: { id: DEMO_ID } }, host: true },
  "app-settings": { href: "/settings", host: true },
  join: { href: "/join" },
  "join-event": { href: { pathname: "/join/[slug]", params: { slug: DEMO_SLUG } } },
  feed: { href: { pathname: "/g/[slug]", params: { slug: DEMO_SLUG } } },
  "guest-upload": { href: { pathname: "/g/[slug]/upload", params: { slug: DEMO_SLUG } } },
  "guest-missions": { href: { pathname: "/g/[slug]/missions", params: { slug: DEMO_SLUG } } },
  "guest-guestbook": { href: { pathname: "/g/[slug]/guestbook", params: { slug: DEMO_SLUG } } },
};

export default function DemoRoute() {
  const { screen, lang } = useLocalSearchParams<{ screen: string; lang?: string }>();
  const { signIn, token } = useAuth();
  const { setLocale, locale } = useI18n();
  const target = TARGETS[String(screen)];

  useEffect(() => {
    if (!DEMO_MODE || !target) return;
    void (async () => {
      if ((lang === "tr" || lang === "en") && lang !== locale) setLocale(lang);
      if (target.host && !token) await signIn("demo-token", demoHost);
      router.replace(target.href);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  if (!DEMO_MODE || !target) return <Redirect href="/" />;
  return <View style={{ flex: 1, backgroundColor: colors.black }} />;
}
