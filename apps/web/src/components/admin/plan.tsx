import type { Access } from "@/lib/access-rules";
import { Pill, STATUS_TONE } from "./ui";

type T = (k: string, v?: Record<string, string | number>) => string;

/** Account pill: deleted (kept anonymised for guests' paid links), suspended, or how many paid events the account has. */
export function UserPill({ suspended, paidEvents, t, deleted }: { suspended: boolean; paidEvents: number; t: T; deleted?: boolean }) {
  if (deleted) return <Pill tone="grey">{t("status.deletedAccount")}</Pill>;
  if (suspended) return <Pill tone="red">{t("status.suspended")}</Pill>;
  return paidEvents ? <Pill tone="green">{t("users.paidEvents", { n: paidEvents })}</Pill> : <Pill tone="grey">{t("users.noPaidEvents")}</Pill>;
}

/** Event pill: deleted, archived, locked by an admin, owner suspended, else the effective package state (setup, paid, live, ended…). */
export function EventPill({ status, access, t }: { status: string; access: Access; t: T }) {
  if (access.removed) return <Pill tone="grey">{t("status.deleted")}</Pill>;
  if (status === "archived") return <Pill tone="grey">{t("status.archived")}</Pill>;
  if (access.reason === "suspended") return <Pill tone="red">{t("status.suspended")}</Pill>;
  if (access.reason === "locked") return <Pill tone="red">{t("status.locked")}</Pill>;
  return <Pill tone={STATUS_TONE[access.state] ?? "grey"}>{t(`status.${access.state}`)}{access.comped && access.paid ? ` · ${t("status.comped")}` : ""}</Pill>;
}

/** Shown when an event passed the fair-use storage limit. */
export function FairUsePill({ t }: { t: T }) {
  return <Pill tone="amber">{t("status.fair_use")}</Pill>;
}

type KeptRow = { deletedAt: Date | null; deletedBy: string | null; filesDeleteAfter: Date | null };

/**
 * Why an event's files still exist although it was deleted or is past retention: guests' paid download links
 * (occasions.files_delete_after). E.g. "Deleted by host · files kept until 12 Mar 2027 for 2 guest purchases".
 */
export function keptForBuyersNote(o: KeptRow, purchases: number, t: T, fmt: (d: Date) => string, now = new Date()): string | null {
  const by = ["host", "account", "admin", "unpaid"].includes(o.deletedBy ?? "") ? o.deletedBy! : "host";
  if (o.deletedAt) {
    if (!o.filesDeleteAfter) return t("event.deletingNow", { by: t(`event.deletedBy.${by}`) });
    return t("event.deletedKept", { by: t(`event.deletedBy.${by}`), date: fmt(o.filesDeleteAfter), n: purchases });
  }
  if (o.filesDeleteAfter && o.filesDeleteAfter > now) return t("event.retentionKept", { date: fmt(o.filesDeleteAfter), n: purchases });
  return null;
}
