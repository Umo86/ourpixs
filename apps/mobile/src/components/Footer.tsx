import * as WebBrowser from "expo-web-browser";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { siteUrl, supportEmail } from "@/config";
import { useI18n } from "@/i18n";
import { colors, fonts, MIN_TOUCH, palette, radius, type Tone } from "@/theme";
import { Txt } from "./Text";

/** TR / EN pill switch (same as the website and guest web app). */
export function LanguageSwitch({ tone = "light" }: { tone?: Tone }) {
  const { locale, setLocale, t } = useI18n();
  const dark = tone === "dark";
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("footer.language")} style={[styles.lang, { backgroundColor: dark ? "rgba(10,10,10,0.55)" : colors.tint }]}>
      {(["tr", "en"] as const).map((l) => {
        const sel = locale === l;
        return (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={l === "tr" ? "Türkçe" : "English"}
            onPress={() => setLocale(l)}
            hitSlop={{ top: 6, bottom: 6 }}
            style={[styles.langItem, sel && { backgroundColor: dark ? colors.white : colors.black }]}
          >
            <Txt style={{ fontFamily: fonts.bold, fontSize: 13, color: sel ? (dark ? colors.black : colors.white) : dark ? colors.white : colors.black }}>
              {l.toUpperCase()}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function openSite(url: string) {
  void WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET }).catch(() => Linking.openURL(url));
}

/** Same footer links as the website: Privacy, Terms, Contact, language switch, copyright. */
export function Footer({ tone = "light" }: { tone?: Tone }) {
  const { t, brand } = useI18n();
  const p = palette(tone);
  const links = [
    { label: t("footer.privacy"), onPress: () => openSite(siteUrl(brand, "/privacy")), role: "link" as const },
    { label: t("footer.terms"), onPress: () => openSite(siteUrl(brand, "/terms")), role: "link" as const },
    { label: t("footer.contact"), onPress: () => void Linking.openURL(`mailto:${supportEmail(brand)}`), role: "link" as const },
  ];
  return (
    <View style={[styles.footer, { borderTopColor: p.border }]}>
      <View style={styles.row}>
        <View style={styles.links}>
          {links.map((l) => (
            <Pressable key={l.label} accessibilityRole={l.role} accessibilityLabel={l.label} onPress={l.onPress} style={styles.link} hitSlop={4}>
              <Txt tone={tone} variant="small" weight="semibold" style={{ textDecorationLine: "underline" }}>
                {l.label}
              </Txt>
            </Pressable>
          ))}
        </View>
        <LanguageSwitch tone={tone} />
      </View>
      <Txt tone={tone} variant="caption" muted>
        {t("footer.copyright", { year: new Date().getFullYear() })}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, marginTop: 8, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  links: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  link: { minHeight: MIN_TOUCH, justifyContent: "center" },
  lang: { flexDirection: "row", borderRadius: radius.pill, padding: 4 },
  langItem: { minWidth: 44, minHeight: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
});
