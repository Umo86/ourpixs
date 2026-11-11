import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ApiError, errorMessage, guestApi } from "@/api/client";
import type { PublicOccasion } from "@/api/types";
import { eventColors, GuestHeader } from "@/components/EventBrand";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Card";
import { Checkbox, Field } from "@/components/Form";
import { LanguageSwitch, openSite } from "@/components/Footer";
import { Screen } from "@/components/Screen";
import { ErrorView, Loading } from "@/components/States";
import { TitleWithAmp } from "@/components/EventTitle";
import { Heading, Txt } from "@/components/Text";
import { DEMO_MODE, occasionLabel, siteUrl } from "@/config";
import { demoImage } from "@/demo/data";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { getGuestSession, getPin, savePin, saveGuestSession } from "@/lib/guestSessions";
import { colors, radius } from "@/theme";

function isPinError(e: unknown) {
  return e instanceof ApiError && (e.status === 401 || e.status === 403) && /pin/i.test(`${e.code} ${e.message}`);
}

export default function JoinEvent() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale, brand } = useI18n();
  const [occasion, setOccasion] = useState<PublicOccasion | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [existing, setExisting] = useState<boolean | null>(null);

  const load = useCallback(
    async (withPin?: string) => {
      setLoadError(null);
      try {
        const res = await guestApi.occasion(String(slug), { pin: withPin ?? null });
        setOccasion(res.occasion);
        if (withPin) {
          setNeedsPin(false);
          await savePin(String(slug), withPin);
        }
      } catch (e) {
        if (isPinError(e)) {
          setNeedsPin(true);
          if (withPin) setFormError(t("join.pinWrong"));
        } else setLoadError(e);
      }
    },
    [slug, t],
  );

  useEffect(() => {
    void (async () => {
      const s = await getGuestSession(String(slug));
      setExisting(!!s && !DEMO_MODE);
      if (s && !DEMO_MODE) return;
      const savedPin = await getPin(String(slug));
      await load(savedPin ?? undefined);
    })();
  }, [slug, load]);

  if (existing) return <Redirect href={{ pathname: "/g/[slug]", params: { slug: String(slug) } }} />;

  const join = async () => {
    if (!name.trim()) return setFormError(t("join.nameRequired"));
    if (!consent) return setFormError(t("join.consentRequired"));
    setFormError(null);
    setBusy(true);
    try {
      const p = pin || (await getPin(String(slug))) || undefined;
      const res = await guestApi.join(String(slug), { name: name.trim(), consent: true, pin: p }, { pin: p });
      await saveGuestSession({
        slug: String(slug), token: res.guestToken, guestId: res.guest.id, name: res.guest.displayName, pin: p, title: occasion?.title,
        joinedAt: new Date().toISOString(),
      });
      router.replace({ pathname: "/g/[slug]", params: { slug: String(slug) } });
    } catch (e) {
      setFormError(isPinError(e) ? t("join.pinWrong") : errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const header = <GuestHeader occasion={occasion} back overlay right={<LanguageSwitch tone="dark" />} />;

  if (loadError) return <Screen tone="dark" header={header}><ErrorView tone="dark" message={errorMessage(loadError, t)} onRetry={() => void load()} /></Screen>;

  if (needsPin && !occasion) {
    return (
      <Screen tone="dark" scroll keyboard header={header}>
        <Heading tone="dark" size="lg" accent={t("join.accent")}>
          {t("join.title")}
        </Heading>
        <Field
          tone="dark"
          label={t("join.pinLabel")}
          help={t("join.pinHelp")}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 8))}
          keyboardType="number-pad"
          maxLength={8}
          error={formError}
          autoFocus
        />
        <Button tone="dark" label={t("common.continue")} disabled={pin.length < 4} onPress={() => void load(pin)} />
      </Screen>
    );
  }

  if (!occasion) return <Screen tone="dark" header={header}><Loading tone="dark" /></Screen>;

  const brandColors = eventColors(occasion);
  const meta = [occasionLabel(occasion.type, locale), occasion.startsOn ? formatDate(occasion.startsOn, locale, { day: "numeric", month: "long" }) : null, occasion.city]
    .filter(Boolean)
    .join(" · ");

  return (
    <Screen tone="dark" scroll keyboard header={header} contentStyle={{ paddingHorizontal: 0 }}>
      <View style={[styles.hero, { backgroundColor: brandColors.heroBg }]}>
        {DEMO_MODE ? <Image source={{ uri: demoImage("selfie") }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,10,10,0.3)" }]} />
        <View style={{ gap: 8 }}>
          <Pill text={meta} tone="dark" />
          <TitleWithAmp title={occasion.title} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, gap: 18 }}>
        <Heading tone="dark" size="sm" accent={t("join.welcomeAccent")} accentColor={brandColors.accent}>
          {t("join.welcomeLine")}
        </Heading>
        <Field
          tone="dark"
          label={t("join.nameLabel")}
          placeholder={t("join.namePlaceholder")}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setFormError(null);
          }}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="done"
          maxLength={40}
        />
        <Checkbox tone="dark" checked={consent} onChange={setConsent} label={t("join.consent")}>
          <Txt tone="dark" variant="small" color={colors.blueOnDarkSoft} style={{ textDecorationLine: "underline", marginTop: 4 }} accessibilityRole="link" onPress={() => openSite(siteUrl(brand, "/privacy"))}>
            {t("join.privacyLink")}
          </Txt>
        </Checkbox>
        {formError ? (
          <Txt tone="dark" variant="small" color={colors.dangerOnDark} accessibilityLiveRegion="assertive">
            {formError}
          </Txt>
        ) : null}
        <Button tone="dark" label={t("join.letMeIn")} iconRight="arrowRight" loading={busy} onPress={() => void join()} />
        <Txt tone="dark" variant="caption" muted center>
          {t("join.tagline")}
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 360, borderBottomLeftRadius: radius.card + 8, borderBottomRightRadius: radius.card + 8, overflow: "hidden", padding: 20, justifyContent: "flex-end", marginTop: -8 },
});
