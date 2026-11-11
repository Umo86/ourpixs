import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, fonts, MIN_TOUCH, radius } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Txt } from "./Text";

export type TabSpec = { icon: IconName; label: string };

/**
 * Host tab bar (light). One style for every host event screen.
 * `specs` maps route name → icon + label (labels come from i18n in the layout).
 */
export function HostTabBar({ state, navigateToTab, insets, specs }: BottomTabBarProps & { specs: Record<string, TabSpec> }) {
  return (
    <View accessibilityRole="tablist" style={[styles.host, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const spec = specs[route.name];
        if (!spec) return null;
        const focused = state.index === i;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={spec.label}
            onPress={() => !focused && navigateToTab(route.key)}
            style={styles.hostItem}
          >
            <View style={[styles.hostIcon, focused && { backgroundColor: colors.black }]}>
              <Icon name={spec.icon} size={20} color={focused ? colors.white : colors.text2} />
            </View>
            <Txt
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{ fontFamily: focused ? fonts.extrabold : fonts.semibold, fontSize: 10, color: focused ? colors.black : colors.muted, paddingHorizontal: 1 }}
            >
              {spec.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Guest tab bar (dark floating pill), matching the web guest app. */
export function GuestTabBar({ state, navigateToTab, insets, specs }: BottomTabBarProps & { specs: Record<string, TabSpec> }) {
  return (
    <View pointerEvents="box-none" style={[styles.guestWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View accessibilityRole="tablist" style={styles.guest}>
        {state.routes.map((route, i) => {
          const spec = specs[route.name];
          if (!spec) return null;
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={spec.label}
              onPress={() => !focused && navigateToTab(route.key)}
              style={[styles.guestItem, focused && { backgroundColor: colors.white, flex: 2.6 }]}
            >
              <Icon name={spec.icon} size={18} color={focused ? colors.black : colors.white} />
              {focused ? (
                <Txt numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.black, flexShrink: 1 }}>
                  {spec.label}
                </Txt>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexDirection: "row", backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight,
    paddingTop: 6, paddingHorizontal: 4,
  },
  hostItem: { flex: 1, alignItems: "center", gap: 2, minHeight: MIN_TOUCH + 8, justifyContent: "center" },
  hostIcon: { width: 40, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  guestWrap: { backgroundColor: colors.black, paddingHorizontal: 16, paddingTop: 8 },
  guest: { flexDirection: "row", backgroundColor: colors.surfaceDark, borderRadius: radius.pill, padding: 6, gap: 4 },
  guestItem: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", minHeight: MIN_TOUCH + 4, borderRadius: radius.pill, paddingHorizontal: 10 },
});
