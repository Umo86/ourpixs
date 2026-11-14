import type { Access } from "@/lib/access-rules";
import { Pill, STATUS_TONE } from "./ui";

type T = (k: string, v?: Record<string, string | number>) => string;

/** Account pill: suspended, or how many paid events the account has. */
export function UserPill({ suspended, paidEvents, t }: { suspended: boolean; paidEvents: number; t: T }) {
  if (suspended) return <Pill tone="red">{t("status.suspended")}</Pill>;
  return paidEvents ? <Pill tone="green">{t("users.paidEvents", { n: paidEvents })}</Pill> : <Pill tone="grey">{t("users.noPaidEvents")}</Pill>;
}

/** Event pill: archived, locked by an admin, owner suspended, else the effective package state (setup, paid, live, ended…). */
export function EventPill({ status, access, t }: { status: string; access: Access; t: T }) {
  if (status === "archived") return <Pill tone="grey">{t("status.archived")}</Pill>;
  if (access.reason === "suspended") return <Pill tone="red">{t("status.suspended")}</Pill>;
  if (access.reason === "locked") return <Pill tone="red">{t("status.locked")}</Pill>;
  return <Pill tone={STATUS_TONE[access.state] ?? "grey"}>{t(`status.${access.state}`)}{access.comped && access.paid ? ` · ${t("status.comped")}` : ""}</Pill>;
}

/** Shown when an event passed the fair-use storage limit. */
export function FairUsePill({ t }: { t: T }) {
  return <Pill tone="amber">{t("status.fair_use")}</Pill>;
}
