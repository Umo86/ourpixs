/** Design tokens — V2 "stylish, fun, high-end". Mirrors AGENTS.md. */
export const colors = {
  black: "#0A0A0A",
  white: "#FFFFFF",
  blue: "#2347E0",
  blueHover: "#16309F",
  blueOnDark: "#4D6BFF",
  blueOnDarkSoft: "#8097FF",
  tint: "#F2F4FB",
  text2: "#3A3A3A",
  muted: "#6B6B6B", // on white only
  mutedOnDark: "#C8CAD2",
  surfaceDark: "#15171F",
  surfaceDark2: "#23262F",
  borderDark: "#3A3F52",
  borderLight: "#E3E5EC",
  danger: "#C62828",
  dangerOnDark: "#FF8A80",
  success: "#1B7F4B",
} as const;

export type Tone = "light" | "dark";

/** Semantic palette per surface: host = light, guest = dark. */
export function palette(tone: Tone) {
  return tone === "dark"
    ? {
        bg: colors.black, fg: colors.white, muted: colors.mutedOnDark, surface: colors.surfaceDark, surface2: colors.surfaceDark2,
        border: colors.borderDark, accent: colors.blueOnDarkSoft, primary: colors.blue, onPrimary: colors.white, danger: colors.dangerOnDark,
      }
    : {
        bg: colors.white, fg: colors.black, muted: colors.muted, surface: colors.tint, surface2: "#E7EAF5",
        border: colors.borderLight, accent: colors.blue, primary: colors.blue, onPrimary: colors.white, danger: colors.danger,
      };
}

export const fonts = {
  regular: "InterTight_400Regular",
  medium: "InterTight_500Medium",
  semibold: "InterTight_600SemiBold",
  bold: "InterTight_700Bold",
  extrabold: "InterTight_800ExtraBold",
  black: "InterTight_900Black",
  serifItalic: "BodoniModa_400Regular_Italic",
} as const;

export const radius = { card: 28, cardSm: 20, input: 16, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const MIN_TOUCH = 44;
