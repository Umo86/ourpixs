import type { PublicOccasion } from "@/api/types";
import { themeOf } from "@/config";
import { colors } from "@/theme";
import { AppHeader, type AppHeaderProps } from "./AppHeader";

/** Colours for guest surfaces, from the event's theme. */
export function eventColors(o: PublicOccasion | null | undefined) {
  const theme = themeOf(o?.theme);
  return {
    heroBg: theme.bg.toUpperCase() === "#FFFFFF" ? colors.surfaceDark : theme.bg,
    accent: colors.blueOnDarkSoft,
  };
}

/** The shared AppHeader (dark) used on every guest screen. Always shows the platform wordmark. */
export function GuestHeader({ occasion: _occasion, ...rest }: Omit<AppHeaderProps, "tone"> & { occasion: PublicOccasion | null }) {
  return <AppHeader tone="dark" {...rest} />;
}
