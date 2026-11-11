import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View, type RefreshControlProps, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette, type Tone } from "@/theme";

/**
 * Page shell: background + status bar per tone, safe-area top, the shared AppHeader (pass it in `header`),
 * optional scrolling and keyboard avoidance. `bottomInset` false when a tab bar handles the bottom edge.
 */
export function Screen({ tone = "light", header, children, scroll = false, contentStyle, refreshControl, bottomInset = true, keyboard = false }: {
  tone?: Tone; header?: ReactNode; children: ReactNode; scroll?: boolean; contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>; bottomInset?: boolean; keyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const p = palette(tone);
  const pb = bottomInset ? Math.max(insets.bottom, 16) : 16;
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ paddingHorizontal: 20, paddingBottom: pb + 8, gap: 16 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingBottom: pb }, contentStyle]}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <StatusBar style={tone === "dark" ? "light" : "dark"} />
      {header}
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}
