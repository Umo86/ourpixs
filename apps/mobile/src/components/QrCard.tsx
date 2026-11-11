import * as Clipboard from "expo-clipboard";
import { useRef, useState } from "react";
import { Alert, Platform, Share, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { useI18n } from "@/i18n";
import { printCard, shareCardPdf, sharePngBase64, type CardText } from "@/lib/qr";
import { colors, palette, radius, type Tone } from "@/theme";
import { Button } from "./Button";
import { Heading, Txt } from "./Text";

type QrRef = { toDataURL: (cb: (data: string) => void) => void } | null;

/** Big QR + event code + copy/share/print actions. Used on the QR tab and the wizard's final step. */
export function QrCard({ url, slug, title, tone = "light", compact }: { url: string; slug: string; title: string; tone?: Tone; compact?: boolean }) {
  const { t, brand } = useI18n();
  const p = palette(tone);
  const ref = useRef<QrRef>(null);
  const [copied, setCopied] = useState(false);

  const card: CardText = {
    brand: t(`brand.${brand}`), title, scan: t("qr.scanToJoin"), footer: t("qr.cardFooter"), codeLabel: t("qr.code"), code: slug, url,
  };

  const copy = async () => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const shareLink = () => void Share.share({ message: t("qr.shareMessage", { title, url }), url: Platform.OS === "ios" ? url : undefined });
  const shareImage = () => {
    const r = ref.current;
    if (!r || Platform.OS === "web") return void shareCardPdf(card).catch(() => undefined);
    r.toDataURL((data) => void sharePngBase64(data, slug, url).catch(() => Alert.alert(t("errors.generic"))));
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.qrWrap, { borderColor: tone === "dark" ? colors.white : colors.black }]} accessible accessibilityRole="image" accessibilityLabel={`${t("qr.scanToJoin")}: ${url}`}>
        <QRCode value={url} size={compact ? 200 : 248} color={colors.black} backgroundColor={colors.white} quietZone={12} ecl="M" getRef={(c: QrRef) => (ref.current = c)} />
      </View>
      <View style={{ alignItems: "center", gap: 2 }}>
        <Txt tone={tone} variant="caption" muted>
          {t("qr.code")}
        </Txt>
        <Heading tone={tone} size="sm" selectable>
          {slug}
        </Heading>
        <Txt tone={tone} variant="small" muted selectable numberOfLines={1}>
          {url}
        </Txt>
      </View>
      <View style={{ gap: 10 }}>
        <Button label={copied ? t("common.copied") : t("qr.copyLink")} icon={copied ? "check" : "copy"} onPress={copy} tone={tone} variant="secondary" />
        <Button label={t("qr.shareLink")} icon="share" onPress={shareLink} tone={tone} />
        {!compact ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button style={{ flex: 1 }} label={t("qr.shareImage")} icon="image" onPress={shareImage} tone={tone} variant="ghost" size="md" />
            <Button style={{ flex: 1 }} label={t("qr.print")} icon="printer" onPress={() => void printCard(card).catch(() => undefined)} tone={tone} variant="ghost" size="md" />
          </View>
        ) : null}
      </View>
      <View style={{ height: 1, backgroundColor: p.border, opacity: 0 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  qrWrap: { alignSelf: "center", padding: 14, borderRadius: radius.card, borderWidth: 2, backgroundColor: colors.white },
});
