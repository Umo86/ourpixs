import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useI18n } from "@/i18n";
import { colors, fonts, palette, type Tone } from "@/theme";
import { IconButton } from "./Button";
import { Txt } from "./Text";

/** Brand wordmark: Bodoni italic name + blue dot. The app is BizimResimler in both languages (APP_BRAND in src/config.ts). */
export function Wordmark({ tone = "light", size = 22 }: { tone?: Tone; size?: number }) {
  const { brand, t } = useI18n();
  const p = palette(tone);
  return (
    <Txt accessibilityRole="header" style={{ fontFamily: fonts.serifItalic, fontSize: size, lineHeight: size * 1.25, color: p.fg }} numberOfLines={1}>
      {t(`brand.${brand}`)}
      <Txt style={{ fontFamily: fonts.serifItalic, fontSize: size, color: tone === "dark" ? colors.blueOnDark : colors.blue }}>.</Txt>
    </Txt>
  );
}

export type AppHeaderProps = {
  tone?: Tone;
  /** Optional context line under the wordmark (event title, step…). */
  title?: string;
  /** true = router.back(); a function = custom back action. */
  back?: boolean | (() => void);
  /** Right-side slot: icon buttons, language switch, live badge… */
  right?: ReactNode;
  /** Transparent background (when overlaying a hero photo). */
  overlay?: boolean;
};

/**
 * The one header used on every screen. Light variant on host screens, dark on guest screens.
 * Layout: [back?] wordmark (+ title)  ……  [right slot]
 */
export function AppHeader({ tone = "light", title, back, right, overlay }: AppHeaderProps) {
  const { t } = useI18n();
  const p = palette(tone);
  const onBack = typeof back === "function" ? back : () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View style={[styles.wrap, { backgroundColor: overlay ? "transparent" : p.bg }]}>
      <View style={styles.left}>
        {back ? <IconButton icon="chevronLeft" label={t("nav.backTo")} onPress={onBack} tone={tone} variant={overlay ? "glass" : "secondary"} size={40} /> : null}
        <View style={{ flexShrink: 1 }}>
          <Wordmark tone={tone} />
          {title ? (
            <Txt tone={tone} variant="caption" weight="semibold" muted numberOfLines={1}>
              {title}
            </Txt>
          ) : null}
        </View>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, minHeight: 60, gap: 12 },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
});
