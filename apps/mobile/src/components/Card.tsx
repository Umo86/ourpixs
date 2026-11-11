import { StyleSheet, View, type ViewProps } from "react-native";

import { colors, fonts, palette, radius, type Tone } from "@/theme";
import { Txt } from "./Text";

/** 28px rounded surface card. */
export function Card({ tone = "light", style, padded = true, ...rest }: ViewProps & { tone?: Tone; padded?: boolean }) {
  const p = palette(tone);
  return <View {...rest} style={[{ backgroundColor: p.surface, borderRadius: radius.card, padding: padded ? 20 : 0, overflow: "hidden" }, style]} />;
}

/** Rotated circular sticker badge (e.g. "212 guests are in"). Decorative text is still read by screen readers. */
export function Sticker({ text, size = 96, rotate = 12, color = colors.blue, textColor = colors.white }: {
  text: string; size?: number; rotate?: number; color?: string; textColor?: string;
}) {
  return (
    <View style={[styles.sticker, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ rotate: `${rotate}deg` }] }]}>
      <Txt style={{ fontFamily: fonts.extrabold, color: textColor, fontSize: Math.max(11, size / 7.5), lineHeight: Math.max(13, size / 6.5), textAlign: "center" }}>
        {text}
      </Txt>
    </View>
  );
}

/** Small pill label ("Wedding · 14 June · London"). */
export function Pill({ text, tone = "light", variant = "solid", rotate }: { text: string; tone?: Tone; variant?: "solid" | "blue" | "glass" | "surface"; rotate?: number }) {
  const p = palette(tone);
  const bg = variant === "blue" ? colors.blue : variant === "glass" ? "rgba(10,10,10,0.6)" : variant === "surface" ? p.surface2 : tone === "dark" ? colors.white : colors.black;
  const fg = variant === "blue" || variant === "glass" ? colors.white : variant === "surface" ? p.fg : tone === "dark" ? colors.black : colors.white;
  return (
    <View style={[styles.pill, { backgroundColor: bg }, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null]}>
      <Txt variant="caption" weight="bold" color={fg} numberOfLines={1}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  sticker: { alignItems: "center", justifyContent: "center", padding: 8 },
  pill: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
});
