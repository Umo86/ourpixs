import { useState } from "react";
import { Alert, View } from "react-native";

import { errorMessage, hostApi } from "@/api/client";
import type { Occasion, OccasionAccess, OccasionSummary } from "@/api/types";
import { EXTERNAL_CHECKOUT, siteUrl } from "@/config";
import { useI18n } from "@/i18n";
import { parseDayMonthYear } from "@/lib/format";
import { formatInZone, utcToZonedFields, zonedToUtc } from "@/lib/tz";
import { colors } from "@/theme";
import { Button } from "./Button";
import { Card } from "./Card";
import { Field } from "./Form";
import { openSite } from "./Footer";
import { Icon, type IconName } from "./Icon";
import { Notice } from "./States";
import { Txt } from "./Text";

type T = ReturnType<typeof useI18n>["t"];

/**
 * Event package status, shown NEUTRALLY: Setup / Opens … / Live until … / Ended · download until … .
 * App Store 3.1.1 / Play billing: no prices, no "buy" wording, no link to a purchase page in store builds.
 * Only non-store dev builds (EXPO_PUBLIC_EXTERNAL_CHECKOUT=1) show a button that opens the web dashboard.
 */
export function packageLine(o: Pick<OccasionSummary, "packageStatus" | "opensAt" | "closesAt" | "deleteAfter" | "timeZone" | "access">, t: T, locale: "en" | "tr"): { label: string; icon: IconName } {
  const d = (iso: string | null) => formatInZone(iso, o.timeZone || "Europe/London", locale);
  if (o.access?.reason === "suspended") return { label: t("package.suspended"), icon: "lock" };
  if (o.access?.reason === "locked") return { label: t("package.locked"), icon: "lock" };
  switch (o.packageStatus) {
    case "setup": return { label: t("package.setup"), icon: "settings" };
    case "paid": return { label: o.opensAt ? t("package.opens", { date: d(o.opensAt) }) : t("package.paidNoDate"), icon: "clock" };
    case "live": return { label: t("package.live", { date: d(o.closesAt) }), icon: "sparkles" };
    case "ended": return { label: o.deleteAfter ? t("package.ended", { date: d(o.deleteAfter) }) : t("package.endedNoDate"), icon: "download" };
    case "refunded": return { label: t("package.refunded"), icon: "lock" };
    default: return { label: t("package.expired"), icon: "lock" };
  }
}

/** Per-event notice from `occasion.access` (null when nothing is restricted). */
export function accessNoticeKey(a: OccasionAccess | undefined | null) {
  switch (a?.reason) {
    case "setup": return "package.noticeSetup" as const;
    case "not_open": return "package.noticeNotOpen" as const;
    case "ended": return "package.noticeEnded" as const;
    case "expired": return "package.noticeExpired" as const;
    case "refunded": return "package.noticeRefunded" as const;
    case "suspended": return "package.noticeSuspended" as const;
    case "locked": return "package.noticeLocked" as const;
    default: return null;
  }
}

/** Dev builds only (EXPO_PUBLIC_EXTERNAL_CHECKOUT=1): open this event on the website. Store builds never render it. */
export function OpenOnWebButton({ occasionId }: { occasionId: string }) {
  const { t, brand, locale } = useI18n();
  if (!EXTERNAL_CHECKOUT) return null;
  return <Button label={t("package.openOnWeb")} icon="link" size="md" variant="secondary" onPress={() => openSite(siteUrl(brand, `/dashboard/${occasionId}`, locale))} />;
}

/**
 * Event settings card: status, gallery window (in the event's time zone), edit the window while allowed,
 * and end a live gallery early.
 */
export function PackageCard({ occasion, onChanged }: { occasion: Occasion; onChanged: (o?: Occasion) => Promise<void> | void }) {
  const { t, locale } = useI18n();
  const pkg = occasion.package;
  const tz = pkg?.timeZone || occasion.timeZone || "Europe/London";
  const line = packageLine(occasion, t, locale);
  const notice = accessNoticeKey(occasion.access);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const start = utcToZonedFields(pkg?.opensAt ?? occasion.opensAt, tz);
  const end = utcToZonedFields(pkg?.closesAt ?? occasion.closesAt, tz);
  const [f, setF] = useState({ openDate: start.date, openTime: start.time || "10:00", closeDate: end.date, closeTime: end.time || "10:00" });

  const saveWindow = async () => {
    setErr(null);
    const od = parseDayMonthYear(f.openDate);
    const cd = parseDayMonthYear(f.closeDate);
    const opens = od ? zonedToUtc(od, f.openTime, tz) : null;
    const closes = cd ? zonedToUtc(cd, f.closeTime, tz) : null;
    if (!opens || !closes) return setErr(t("package.windowInvalid"));
    if (closes <= opens) return setErr(t("package.windowOrder"));
    if (closes.getTime() - opens.getTime() > (pkg?.windowDays ?? 7) * 86400_000) return setErr(t("package.windowTooLong", { n: pkg?.windowDays ?? 7 }));
    setBusy(true);
    try {
      const res = await hostApi.update(occasion.id, { opensAt: opens.toISOString(), closesAt: closes.toISOString(), timeZone: tz });
      setEditing(false);
      await onChanged(res.occasion);
    } catch (e) {
      setErr(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const endNow = () =>
    Alert.alert(t("package.endTitle"), t("package.endBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("package.endConfirm"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            const res = await hostApi.endGallery(occasion.id);
            await onChanged(res.occasion);
          } catch (e) {
            Alert.alert(errorMessage(e, t));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <Card style={{ gap: 12 }}>
      <Txt variant="label" weight="extrabold" muted style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
        {t("package.title")}
      </Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name={line.icon} size={20} color={colors.blue} />
        <Txt weight="extrabold" style={{ flex: 1 }}>{line.label}</Txt>
      </View>
      {pkg?.opensAt && pkg?.closesAt ? (
        <Txt variant="small" muted>
          {t("package.window", { from: formatInZone(pkg.opensAt, tz, locale, { year: true }), to: formatInZone(pkg.closesAt, tz, locale, { year: true }), tz })}
        </Txt>
      ) : null}
      {notice ? <Notice icon={occasion.access?.readOnly ? "lock" : "sparkles"} text={t(notice, { n: pkg?.testUploadLimit ?? 20 })} /> : null}

      {pkg?.canEditWindow && !editing ? (
        <Button label={pkg.opensAt ? t("package.editWindow") : t("package.setWindow")} icon="clock" size="md" variant="secondary" onPress={() => setEditing(true)} />
      ) : null}
      {editing ? (
        <View style={{ gap: 10 }}>
          <Txt variant="small" muted>{t("package.windowHelp", { n: pkg?.windowDays ?? 7, tz })}</Txt>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 3 }}><Field label={t("package.opensDate")} placeholder={t("wizard.datePlaceholder")} value={f.openDate} onChangeText={(v) => setF((x) => ({ ...x, openDate: v }))} keyboardType="numbers-and-punctuation" /></View>
            <View style={{ flex: 2 }}><Field label={t("package.time")} placeholder="10:00" value={f.openTime} onChangeText={(v) => setF((x) => ({ ...x, openTime: v }))} keyboardType="numbers-and-punctuation" /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 3 }}><Field label={t("package.closesDate")} placeholder={t("wizard.datePlaceholder")} value={f.closeDate} onChangeText={(v) => setF((x) => ({ ...x, closeDate: v }))} keyboardType="numbers-and-punctuation" /></View>
            <View style={{ flex: 2 }}><Field label={t("package.time")} placeholder="10:00" value={f.closeTime} onChangeText={(v) => setF((x) => ({ ...x, closeTime: v }))} keyboardType="numbers-and-punctuation" /></View>
          </View>
          {err ? <Notice icon="alert" text={err} /> : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label={t("common.save")} size="md" full={false} loading={busy} onPress={() => void saveWindow()} />
            <Button label={t("common.cancel")} size="md" full={false} variant="ghost" onPress={() => { setEditing(false); setErr(null); }} />
          </View>
        </View>
      ) : null}
      {pkg?.canEndEarly ? <Button label={t("package.endNow")} icon="lock" size="md" variant="danger" loading={busy && !editing} onPress={endNow} /> : null}
      <OpenOnWebButton occasionId={occasion.id} />
    </Card>
  );
}
