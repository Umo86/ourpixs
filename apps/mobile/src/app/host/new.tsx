import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { errorMessage, hostApi } from "@/api/client";
import type { Occasion } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Chip, Field } from "@/components/Form";
import { Icon, type IconName } from "@/components/Icon";
import { QrCard } from "@/components/QrCard";
import { Screen } from "@/components/Screen";
import { Notice } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { buildTitle, DEMO_MODE, HONOREE_COUNT, OCCASION_TYPES, OCCASIONS, THEME_NAMES, THEMES, type OccasionType, type ThemeName } from "@/config";
import { demoOccasion, DEMO_ID } from "@/demo/data";
import { useI18n } from "@/i18n";
import { parseDayMonthYear } from "@/lib/format";
import { colors, fonts, palette, radius } from "@/theme";

const TYPE_ICON: Record<OccasionType, IconName> = {
  dugun: "heart", nisan: "sparkles", kina: "star", sunnet: "star", dogum_gunu: "sparkles", bebek: "heart", mezuniyet: "star",
  yildonumu: "heart", ev_partisi: "users", kurumsal: "users", diger: "plus",
};

function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

type Step = "type" | "names" | "details" | "theme" | "created";
const STEPS: Step[] = ["type", "names", "details", "theme"];

export default function NewOccasion() {
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ step?: string }>();
  const { refreshMe } = useAuth();
  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<OccasionType>("dugun");
  const [names, setNames] = useState<string[]>(["", ""]);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [dayIdx, setDayIdx] = useState<number[]>([0]);
  const [theme, setTheme] = useState<ThemeName>("noir");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Occasion | null>(null);

  // Demo deep links can open a specific step for screenshots.
  useEffect(() => {
    if (!DEMO_MODE || !params.step) return;
    if (params.step === "created") {
      setCreated(demoOccasion(DEMO_ID));
      setStep("created");
    } else if ((STEPS as string[]).includes(params.step)) {
      setNames(["Elif", "Can"]);
      setStep(params.step as Step);
    }
  }, [params.step]);

  const spec = OCCASIONS[type];
  const count = HONOREE_COUNT[type];
  const presetDays = spec.days.map((d) => d[locale]);
  const suggested = useMemo(() => buildTitle(type, names.slice(0, count), locale), [type, names, count, locale]);
  const finalTitle = titleEdited ? title : suggested;
  const stepNo = STEPS.indexOf(step) + 1;

  const chooseType = (tp: OccasionType) => {
    setType(tp);
    const d = OCCASIONS[tp].days;
    // Default to the main day (e.g. "Wedding" rather than "Henna night") — a sensible default; more days can be picked below.
    const main = d.findIndex((x) => x.en === OCCASIONS[tp].label.en);
    setDayIdx([main >= 0 ? main : 0]);
    setTitleEdited(false);
    setStep("names");
  };

  const next = () => {
    setError(null);
    if (step === "names") {
      if (!names.slice(0, count).every((n) => n.trim()) || !finalTitle.trim()) return setError(t("wizard.required"));
      return setStep("details");
    }
    if (step === "details") {
      if (date && !parseDayMonthYear(date)) return setError(t("wizard.dateInvalid"));
      return setStep("theme");
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const startsOn = date ? parseDayMonthYear(date) ?? undefined : undefined;
      const { occasion } = await hostApi.create({
        type,
        title: finalTitle.trim(),
        honorees: names.slice(0, count).map((n) => n.trim()).filter(Boolean),
        startsOn,
        venueName: venue.trim() || undefined,
        city: city.trim() || undefined,
        theme,
        days: [...dayIdx].sort().map((i) => ({ name: presetDays[i], date: startsOn })),
        // New events start in setup (free). The gallery window defaults to the event date, 10:00 in this zone.
        timeZone: deviceTimeZone(),
      });
      setCreated(occasion);
      setStep("created");
      void refreshMe();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    const i = STEPS.indexOf(step);
    if (step === "created" || i <= 0) router.back();
    else setStep(STEPS[i - 1]);
  };

  return (
    <Screen
      tone="light"
      scroll
      keyboard
      header={<AppHeader tone="light" back={back} title={step === "created" ? created?.title : t("wizard.step", { n: stepNo, total: STEPS.length })} />}
    >
      {step === "type" ? (
        <>
          <Heading size="lg" accent={t("wizard.typeAccent")}>
            {t("wizard.typeTitle")}
          </Heading>
          <View style={styles.grid}>
            {OCCASION_TYPES.map((tp) => {
              const sel = tp === type;
              return (
                <Pressable
                  key={tp}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={OCCASIONS[tp].label[locale]}
                  onPress={() => chooseType(tp)}
                  style={({ pressed }) => [styles.typeTile, sel && styles.typeTileSel, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Icon name={TYPE_ICON[tp]} size={22} color={sel ? colors.white : colors.blue} />
                  <Txt weight="extrabold" color={sel ? colors.white : colors.black}>
                    {OCCASIONS[tp].label[locale]}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {step === "names" ? (
        <>
          <Heading size="lg" accent={t("wizard.namesAccent")}>
            {t("wizard.namesTitle")}
          </Heading>
          {Array.from({ length: count }).map((_, i) => (
            <Field
              key={i}
              label={type === "kurumsal" ? t("wizard.companyTitle") : count === 1 ? t("wizard.nameSingle") : i === 0 ? t("wizard.name1") : t("wizard.name2")}
              value={names[i] ?? ""}
              onChangeText={(v) => setNames((prev) => prev.map((n, j) => (j === i ? v : n)))}
              autoCapitalize="words"
              autoFocus={i === 0}
              returnKeyType="next"
            />
          ))}
          <Field
            label={t("wizard.titleLabel")}
            value={finalTitle}
            onChangeText={(v) => {
              setTitle(v);
              setTitleEdited(true);
            }}
            help={t("wizard.titleHelp")}
            error={error}
          />
          <Button label={t("common.continue")} iconRight="arrowRight" onPress={next} />
        </>
      ) : null}

      {step === "details" ? (
        <>
          <Heading size="lg" accent={t("wizard.detailsAccent")}>
            {t("wizard.detailsTitle")}
          </Heading>
          <Field label={t("wizard.dateLabel")} placeholder={t("wizard.datePlaceholder")} value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" error={error} />
          <Field label={t("wizard.venueLabel")} placeholder={t("wizard.venuePlaceholder")} value={venue} onChangeText={setVenue} autoCapitalize="words" />
          <Field label={t("wizard.cityLabel")} placeholder={t("wizard.cityPlaceholder")} value={city} onChangeText={setCity} autoCapitalize="words" />
          {presetDays.length > 1 ? (
            <View style={{ gap: 8 }}>
              <Txt variant="label" weight="semibold" muted>
                {t("wizard.daysLabel")}
              </Txt>
              <View style={styles.chips}>
                {presetDays.map((d, i) => (
                  <Chip
                    key={d}
                    label={d}
                    selected={dayIdx.includes(i)}
                    onPress={() => setDayIdx((prev) => (prev.includes(i) ? (prev.length > 1 ? prev.filter((x) => x !== i) : prev) : [...prev, i]))}
                  />
                ))}
              </View>
              <Txt variant="small" muted>
                {t("wizard.daysHelp")}
              </Txt>
            </View>
          ) : null}
          <Button label={t("common.continue")} iconRight="arrowRight" onPress={next} />
        </>
      ) : null}

      {step === "theme" ? (
        <>
          <Heading size="lg" accent={t("wizard.themeAccent")}>
            {t("wizard.themeTitle")}
          </Heading>
          <View style={styles.grid}>
            {THEME_NAMES.map((name) => {
              const th = THEMES[name];
              const sel = name === theme;
              return (
                <Pressable
                  key={name}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={t(`wizard.themes.${name}`)}
                  onPress={() => setTheme(name)}
                  style={[styles.themeTile, { backgroundColor: th.bg, borderColor: sel ? colors.blue : palette("light").border, borderWidth: sel ? 3 : 1 }]}
                >
                  <Txt style={{ fontFamily: fonts.black, fontSize: 22, color: th.fg, letterSpacing: -0.8 }} numberOfLines={1}>
                    {(names[0] || "Elif").trim()}{" "}
                    <Txt style={{ fontFamily: fonts.serifItalic, fontSize: 22, color: th.accent }}>&amp;</Txt>
                  </Txt>
                  <Txt variant="small" weight="bold" color={th.fg}>
                    {t(`wizard.themes.${name}`)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          {error ? <Notice text={error} icon="alert" /> : null}
          <Button label={busy ? t("wizard.creating") : t("wizard.create")} loading={busy} onPress={create} icon="sparkles" />
        </>
      ) : null}

      {step === "created" && created ? (
        <>
          <Heading size="lg" accent={t("wizard.createdAccent")}>
            {t("wizard.createdTitle")}
          </Heading>
          <Txt muted>{t("wizard.createdBody")}</Txt>
          <Notice icon="clock" text={t("package.createdSetup")} />
          <QrCard url={created.guestUrl} slug={created.slug} title={created.title} compact />
          <Button label={t("wizard.openEvent")} variant="inverse" iconRight="arrowRight" onPress={() => router.replace({ pathname: "/host/[id]", params: { id: created.id } })} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeTile: { width: "48%", flexGrow: 1, minHeight: 92, borderRadius: radius.cardSm, backgroundColor: colors.tint, padding: 16, gap: 10, justifyContent: "space-between" },
  typeTileSel: { backgroundColor: colors.blue },
  themeTile: { width: "48%", flexGrow: 1, height: 110, borderRadius: radius.cardSm, padding: 16, justifyContent: "space-between" },
});
