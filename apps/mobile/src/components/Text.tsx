import { Text as RNText, type TextProps, type TextStyle } from "react-native";

import { fonts, palette, type Tone } from "@/theme";

type Weight = "regular" | "medium" | "semibold" | "bold" | "extrabold" | "black";
type Variant = "body" | "small" | "caption" | "label" | "title" | "lead";

const VARIANTS: Record<Variant, TextStyle> = {
  body: { fontSize: 16, lineHeight: 23 },
  lead: { fontSize: 18, lineHeight: 26 },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 13, lineHeight: 18 },
  title: { fontSize: 22, lineHeight: 26, letterSpacing: -0.6 },
};

export type TxtProps = TextProps & { tone?: Tone; weight?: Weight; variant?: Variant; muted?: boolean; color?: string; center?: boolean };

/** Inter Tight text. Tone picks the default colour for light (host) or dark (guest) surfaces. */
export function Txt({ tone = "light", weight = "regular", variant = "body", muted, color, center, style, ...rest }: TxtProps) {
  const p = palette(tone);
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[VARIANTS[variant], { fontFamily: fonts[weight], color: color ?? (muted ? p.muted : p.fg) }, center && { textAlign: "center" }, style]}
    />
  );
}

/** Bodoni Moda italic emphasis, used inline inside a Heading or Txt. */
export function Serif({ children, color, style, ...rest }: TextProps & { color?: string }) {
  return (
    <RNText {...rest} style={[{ fontFamily: fonts.serifItalic, color, fontWeight: "400", letterSpacing: 0 }, style]}>
      {children}
    </RNText>
  );
}

type HeadingSize = "xl" | "lg" | "md" | "sm";
const H: Record<HeadingSize, TextStyle> = {
  xl: { fontSize: 52, lineHeight: 50, letterSpacing: -2.2 },
  lg: { fontSize: 38, lineHeight: 39, letterSpacing: -1.6 },
  md: { fontSize: 28, lineHeight: 30, letterSpacing: -1 },
  sm: { fontSize: 22, lineHeight: 25, letterSpacing: -0.7 },
};

/**
 * Heavy Inter Tight headline with an optional Bodoni italic accent, e.g.
 * <Heading accent="every angle.">Your day,</Heading>
 */
export function Heading({ children, accent, tone = "light", size = "lg", accentColor, color, center, style, ...rest }: TextProps & {
  accent?: string; tone?: Tone; size?: HeadingSize; accentColor?: string; color?: string; center?: boolean;
}) {
  const p = palette(tone);
  return (
    <RNText
      accessibilityRole="header"
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[H[size], { fontFamily: fonts.black, color: color ?? p.fg }, center && { textAlign: "center" }, style]}
    >
      {children}
      {accent ? (
        <>
          {children ? " " : ""}
          <Serif color={accentColor ?? p.accent}>{accent}</Serif>
        </>
      ) : null}
    </RNText>
  );
}
