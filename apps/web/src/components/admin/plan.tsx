import type { Access } from "@/lib/access";
import type { Locale } from "@/lib/config";
import { formatDate } from "@/lib/client/format";
import { Pill, STATUS_TONE } from "./ui";

type T = (k: string, v?: Record<string, string | number>) => string;

/** Plan status pill (+ interval) for an account, with admin overrides first. */
export function PlanPill({ access, t }: { access: Access; t: T }) {
  if (access.suspended) return <Pill tone="red">{t("status.suspended")}</Pill>;
  if (access.comped) return <Pill tone="ink">{t("status.comped")}</Pill>;
  const s = access.status;
  return (
    <Pill tone={STATUS_TONE[s] ?? "grey"}>
      {t(`status.${s}`)}{access.interval && (s === "active" || s === "past_due" || s === "cancelled") ? ` · ${t(`status.${access.interval}`)}` : ""}
    </Pill>
  );
}

/** The date that matters for the current state: comp end, trial end, renewal / period end, or deletion. */
export function planDate(access: Access, t: T, locale: Locale): string {
  const d = (x: Date | null) => (x ? formatDate(x.toISOString(), locale) : "");
  if (access.comped) return t("users.compUntil", { date: d(access.compUntil) });
  if (access.status === "trialing" || access.status === "expired") return access.trialEndsAt ? t("users.trialEnds", { date: d(access.trialEndsAt) }) : "";
  if (access.status === "active" || access.status === "past_due") return access.currentPeriodEnd ? t(access.cancelAtPeriodEnd ? "users.endsOn" : "users.renewsOn", { date: d(access.currentPeriodEnd) }) : "";
  if (access.status === "cancelled") return access.currentPeriodEnd ? t("users.endedOn", { date: d(access.currentPeriodEnd) }) : "";
  return "";
}

/** Event state pill: archived, locked by an admin, read-only (owner's account), or live. */
export function EventPill({ status, access, t }: { status: string; access: Access; t: T }) {
  if (status === "archived") return <Pill tone="grey">{t("status.archived")}</Pill>;
  if (access.reason === "locked") return <Pill tone="red">{t("status.locked")}</Pill>;
  if (access.readOnly) return <Pill tone="amber">{t("status.readonly")}</Pill>;
  return <Pill tone="green">{t("status.live")}</Pill>;
}
