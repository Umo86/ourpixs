import { View } from "react-native";

import type { OccasionAccess, Subscription } from "@/api/types";
import { EXTERNAL_CHECKOUT, siteUrl } from "@/config";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { Button } from "./Button";
import { Card } from "./Card";
import { openSite } from "./Footer";
import { Icon, type IconName } from "./Icon";
import { Notice } from "./States";
import { Txt } from "./Text";
import { colors } from "@/theme";

type T = ReturnType<typeof useI18n>["t"];

/**
 * Neutral plan status text. App Store 3.1.1 / Play billing: no prices, no "subscribe" wording,
 * no link to a purchase page (the only exception is the EXPO_PUBLIC_EXTERNAL_CHECKOUT dev flag, see `ChoosePlanButton`).
 */
export function planSummary(sub: Subscription, t: T, locale: "en" | "tr"): { headline: string; detail: string | null; icon: IconName } {
  const date = (v: string | null) => (v ? formatDate(v, locale) : null);
  switch (sub.status) {
    case "none":
      return { headline: t("account.none"), detail: t("account.noneBody"), icon: "sparkles" };
    case "trialing": {
      const n = sub.daysLeft;
      const headline = n === null ? t("account.trial") : n <= 0 ? t("account.trialToday") : n === 1 ? t("account.trialOneDay") : t("account.trialDays", { n });
      return { headline, detail: t("account.trialBody"), icon: "sparkles" };
    }
    case "active": {
      const headline = sub.interval === "month" ? t("account.planMonthly") : sub.interval === "year" ? t("account.planYearly") : t("account.planActive");
      const end = date(sub.currentPeriodEnd);
      const detail = !end ? null : sub.cancelAtPeriodEnd ? t("account.endsOn", { date: end }) : t("account.renewsOn", { date: end });
      return { headline, detail, icon: "checkCircle" };
    }
    case "past_due":
      return { headline: t("account.pastDue"), detail: t("account.pastDueBody"), icon: "alert" };
    case "cancelled": {
      const del = date(sub.deleteAfter);
      return { headline: t("account.cancelled"), detail: del ? t("account.readOnlyUntilDelete", { date: del }) : t("account.readOnly"), icon: "lock" };
    }
    case "expired": {
      const del = date(sub.deleteAfter);
      return { headline: t("account.trialEnded"), detail: del ? t("account.readOnlyUntilDelete", { date: del }) : t("account.readOnly"), icon: "lock" };
    }
  }
}

/** Non-store dev builds only (EXPO_PUBLIC_EXTERNAL_CHECKOUT=1). Store builds never render this. */
export function ChoosePlanButton({ sub }: { sub: Subscription | null }) {
  const { t, brand, locale } = useI18n();
  if (!EXTERNAL_CHECKOUT || !sub?.showUpgradePrompt) return null;
  return <Button label={t("account.choosePlan")} icon="sparkles" size="md" onPress={() => openSite(siteUrl(brand, "/pricing", locale))} />;
}

/** Plan status card for app settings. */
export function PlanCard({ sub }: { sub: Subscription | null }) {
  const { t, locale } = useI18n();
  if (!sub) return null;
  const s = planSummary(sub, t, locale);
  return (
    <Card style={{ gap: 10 }}>
      <Txt weight="extrabold">{t("account.title")}</Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name={s.icon} size={20} color={colors.blue} />
        <Txt weight="extrabold" style={{ flex: 1 }}>
          {s.headline}
        </Txt>
      </View>
      {s.detail ? (
        <Txt variant="small" muted>
          {s.detail}
        </Txt>
      ) : null}
      {sub.status !== "none" && !sub.canDownload ? (
        <Txt variant="small" muted>
          {t("account.downloadsLocked")}
        </Txt>
      ) : null}
      <ChoosePlanButton sub={sub} />
    </Card>
  );
}

/** Short banner for the events list: only when the plan needs attention. */
export function PlanBanner({ sub }: { sub: Subscription | null }) {
  const { t, locale } = useI18n();
  if (!sub || sub.status === "none") return null;
  if (sub.status === "active" && !sub.cancelAtPeriodEnd) return null;
  const s = planSummary(sub, t, locale);
  return (
    <View style={{ gap: 10 }}>
      <Notice icon={s.icon} text={s.detail ? `${s.headline}. ${s.detail}` : s.headline} />
      <ChoosePlanButton sub={sub} />
    </View>
  );
}

/** Per-event notice from `occasion.access` (null when nothing is restricted). */
export function accessNoticeKey(a: OccasionAccess | undefined | null) {
  if (!a || !a.reason) return null;
  switch (a.reason) {
    case "trial":
      return "account.eventTrial" as const;
    case "cancelled":
      return "account.eventCancelled" as const;
    case "past_due":
      return "account.eventPastDue" as const;
    case "trial_ended":
      return "account.eventTrialEnded" as const;
  }
}
