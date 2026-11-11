import { Image } from "expo-image";
import { View } from "react-native";

import type { PublicOccasion } from "@/api/types";
import { themeOf, type BrandingMode } from "@/config";
import { colors, fonts } from "@/theme";
import { AppHeader, Wordmark, type AppHeaderProps } from "./AppHeader";
import { Txt } from "./Text";

const HEX = /^#[0-9a-f]{6}$/i;
const safeColor = (c: string | null | undefined, fallback: string) => (c && HEX.test(c) ? c : fallback);

export function brandingModeOf(o: PublicOccasion | null | undefined): BrandingMode {
  const m = o?.brandingMode;
  return m === "venue" || m === "couple" || m === "both" ? m : "platform";
}

/** Colours for guest surfaces: venue colours when the event is venue-branded, else the event theme. */
export function eventColors(o: PublicOccasion | null | undefined) {
  const theme = themeOf(o?.theme);
  const mode = brandingModeOf(o);
  const venue = mode === "venue" || mode === "both";
  const heroBg = venue ? safeColor(o?.branding?.primaryColor, theme.bg) : theme.bg;
  return {
    heroBg: heroBg.toUpperCase() === "#FFFFFF" ? colors.surfaceDark : heroBg,
    accent: venue ? safeColor(o?.branding?.accentColor, colors.blueOnDarkSoft) : colors.blueOnDarkSoft,
  };
}

function monogramOf(o: PublicOccasion): string {
  if (o.branding?.monogram) return o.branding.monogram;
  const initials = (o.honorees ?? []).map((h) => h.trim().charAt(0).toLocaleUpperCase()).filter(Boolean);
  return initials.length ? initials.join(" & ") : o.title;
}

function VenueMark({ o }: { o: PublicOccasion }) {
  const { accent } = eventColors(o);
  const logo = o.branding?.venueLogoUrl;
  const name = o.branding?.venueName ?? o.venueName ?? "";
  if (logo) return <Image source={{ uri: logo }} style={{ height: 30, width: 130 }} contentFit="contain" contentPosition="left" accessibilityLabel={name} />;
  return (
    <Txt style={{ fontFamily: fonts.serifItalic, fontSize: 22, color: colors.white }} numberOfLines={1} accessibilityRole="header">
      {name}
      <Txt style={{ fontFamily: fonts.serifItalic, fontSize: 22, color: accent }}>.</Txt>
    </Txt>
  );
}

function CoupleMark({ o }: { o: PublicOccasion }) {
  if (o.branding?.coupleLogoUrl) {
    return <Image source={{ uri: o.branding.coupleLogoUrl }} style={{ height: 30, width: 90 }} contentFit="contain" contentPosition="left" accessibilityLabel={o.title} />;
  }
  return (
    <Txt style={{ fontFamily: fonts.serifItalic, fontSize: 22, color: colors.white }} numberOfLines={1} accessibilityLabel={o.title}>
      {monogramOf(o)}
    </Txt>
  );
}

/**
 * The brand mark guests see, per event branding_mode:
 * platform → our wordmark; venue → venue logo/name; couple → monogram; both → venue · couple.
 */
export function EventBrandMark({ occasion }: { occasion: PublicOccasion | null }) {
  const mode = brandingModeOf(occasion);
  if (!occasion || mode === "platform") return <Wordmark tone="dark" />;
  if (mode === "venue") return <VenueMark o={occasion} />;
  if (mode === "couple") return <CoupleMark o={occasion} />;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <VenueMark o={occasion} />
      <Txt tone="dark" muted>
        ·
      </Txt>
      <CoupleMark o={occasion} />
    </View>
  );
}

/** The shared AppHeader (dark) with event branding applied. Used on every guest screen. */
export function GuestHeader({ occasion, ...rest }: Omit<AppHeaderProps, "tone" | "mark"> & { occasion: PublicOccasion | null }) {
  return <AppHeader tone="dark" mark={<EventBrandMark occasion={occasion} />} {...rest} />;
}
