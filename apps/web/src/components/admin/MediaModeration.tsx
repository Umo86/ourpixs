"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Ban, Check, EyeOff, Play, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Notice } from "@/components/app/Notice";
import { Lightbox } from "@/components/app/Lightbox";
import { useLocale, useT } from "@/i18n/client";
import { formatDateTime } from "@/lib/client/format";
import type { MediaItem } from "@/lib/api-types";
import type { AdminMedia as AdminMediaItem } from "@/lib/admin-queries";
import { Dialog, useAdminRequest } from "./AdminAction";

type MediaAction = "approve" | "restore" | "hide" | "delete";

const toLightbox = (items: AdminMediaItem[]): MediaItem[] => items.map((m) => ({
  id: m.id, kind: m.kind, thumbUrl: m.thumbUrl, displayUrl: m.displayUrl, playbackUrl: m.playbackUrl,
  width: null, height: null, durationS: null, momentTag: null, dayId: null, guestName: m.guestName, reactionCount: 0, createdAt: m.createdAt,
}));

function useLightboxLabels() {
  const t = useT("admin");
  return useMemo(() => ({
    close: t("common.close"), prev: t("common.previous"), next: t("common.next"), download: t("media.download"),
    by: (name: string) => t("media.by", { name }),
  }), [t]);
}

function Thumb({ item, onOpen, label }: { item: AdminMediaItem; onOpen: () => void; label: string }) {
  return (
    <button type="button" onClick={onOpen} aria-label={label}
      className="group relative block aspect-square w-full overflow-hidden rounded-2xl bg-tint focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky">
      {item.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbUrl} alt="" loading="lazy" className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${item.visibility === "hidden" ? "opacity-50" : ""}`} />
      ) : <span className="flex h-full w-full items-center justify-center text-xs font-bold text-muted">{item.kind}</span>}
      {item.kind === "video" ? <span className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white"><Play size={14} aria-hidden /></span> : null}
    </button>
  );
}

function Tags({ item }: { item: AdminMediaItem }) {
  const t = useT("admin");
  const tags: { label: string; tone: string }[] = [];
  if (item.visibility === "hidden") tags.push({ label: t("status.hidden"), tone: "bg-tint text-text-2" });
  if (!item.approved) tags.push({ label: t("status.pending"), tone: "bg-[#FFF3D6] text-[#7A4B00]" });
  for (const f of item.flags) tags.push({ label: t(`flags.${f}`) === `flags.${f}` ? f : t(`flags.${f}`), tone: f === "nsfw" || f === "reported" ? "bg-[#FDECEC] text-[#8A1C1C]" : "bg-[#E6EBFD] text-[#16309F]" });
  if (!tags.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((x) => <span key={x.label} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${x.tone}`}>{x.label}</span>)}
    </span>
  );
}

const iconBtn = "inline-flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-[#D5D8E2] bg-white text-ink hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky disabled:opacity-50";

/** Event media grid: thumbs, per-item hide / restore / delete, and bulk selection. */
export function MediaGrid({ items }: { items: AdminMediaItem[] }) {
  const t = useT("admin");
  const labels = useLightboxLabels();
  const { run, busy, error } = useAdminRequest();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const closeConfirm = useCallback(() => setConfirmDelete(null), []);
  const lb = useMemo(() => toLightbox(items), [items]);

  const act = async (ids: string[], action: MediaAction) => {
    const ok = await run("/api/admin/media", "PATCH", { ids, action });
    if (ok) setSelected(new Set());
    return ok;
  };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...selected];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-[24px] bg-tint p-3" role="toolbar" aria-label={t("media.bulk")}>
        <span className="px-2 text-sm font-bold">{t("media.selected", { n: ids.length })}</span>
        <Button variant="secondary" onClick={() => setSelected(ids.length === items.length ? new Set() : new Set(items.map((i) => i.id)))}>
          {ids.length === items.length && items.length ? t("media.selectNone") : t("media.selectAll")}
        </Button>
        <Button variant="secondary" disabled={!ids.length || busy} onClick={() => act(ids, "restore")}><RotateCcw size={16} aria-hidden />{t("media.restore")}</Button>
        <Button variant="secondary" disabled={!ids.length || busy} onClick={() => act(ids, "hide")}><EyeOff size={16} aria-hidden />{t("media.hide")}</Button>
        <Button variant="secondary" className="border-[#B42318]! text-[#B42318]! hover:bg-[#B42318]! hover:text-white!" disabled={!ids.length || busy} onClick={() => setConfirmDelete(ids)}>
          <Trash2 size={16} aria-hidden />{t("media.delete")}
        </Button>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((m, i) => {
          const checked = selected.has(m.id);
          return (
            <li key={m.id} className={`flex flex-col gap-2 rounded-[20px] p-1.5 ${checked ? "bg-[#E6EBFD]" : ""}`}>
              <div className="relative">
                <Thumb item={m} onOpen={() => setOpen(i)} label={t("media.open", { name: m.guestName || t("common.unknownGuest") })} />
                <label className="absolute left-2 top-2 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow">
                  <input type="checkbox" checked={checked} onChange={() => toggle(m.id)} className="h-5 w-5 accent-[#2347E0]" />
                  <span className="sr-only">{t("media.select")}</span>
                </label>
              </div>
              <div className="flex flex-col gap-1 px-1">
                <span className="truncate text-[13px] font-semibold">{m.guestName || t("common.unknownGuest")}</span>
                <Tags item={m} />
              </div>
              <div className="flex gap-2 px-1 pb-1">
                {m.visibility === "hidden" || !m.approved ? (
                  <button type="button" className={iconBtn} disabled={busy} onClick={() => act([m.id], "restore")} aria-label={t("media.restore")} title={t("media.restore")}><RotateCcw size={16} aria-hidden /></button>
                ) : (
                  <button type="button" className={iconBtn} disabled={busy} onClick={() => act([m.id], "hide")} aria-label={t("media.hide")} title={t("media.hide")}><EyeOff size={16} aria-hidden /></button>
                )}
                <button type="button" className={`${iconBtn} text-[#B42318]`} disabled={busy} onClick={() => setConfirmDelete([m.id])} aria-label={t("media.delete")} title={t("media.delete")}><Trash2 size={16} aria-hidden /></button>
              </div>
            </li>
          );
        })}
      </ul>
      {open !== null ? <Lightbox items={lb} index={open} onIndex={setOpen} onClose={() => setOpen(null)} labels={labels} downloadUrl={() => null} /> : null}
      <DeleteMediaDialog ids={confirmDelete} onClose={closeConfirm} onConfirm={async (x) => { if (await act(x, "delete")) setConfirmDelete(null); }} busy={busy} />
    </div>
  );
}

function DeleteMediaDialog({ ids, onClose, onConfirm, busy }: { ids: string[] | null; onClose: () => void; onConfirm: (ids: string[]) => void; busy: boolean }) {
  const t = useT("admin");
  return (
    <Dialog open={!!ids} onClose={onClose} title={t("media.deleteTitle", { n: ids?.length ?? 0 })}>
      <p className="m-0 text-[15px] text-text-2">{t("media.deleteBody")}</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" className="border-[#B42318]! text-[#B42318]! hover:bg-[#B42318]! hover:text-white!" disabled={busy} onClick={() => ids && onConfirm(ids)}>
          {busy ? t("common.working") : t("media.deleteConfirm")}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
      </div>
    </Dialog>
  );
}

/** Cross-event moderation queue: reported and auto-flagged media, newest first. */
export function ModerationQueue({ items }: { items: AdminMediaItem[] }) {
  const t = useT("admin");
  const { locale } = useLocale();
  const labels = useLightboxLabels();
  const { run, busy, error } = useAdminRequest();
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "block"; item: AdminMediaItem } | null>(null);
  const closeConfirm = useCallback(() => setConfirm(null), []);
  const lb = useMemo(() => toLightbox(items), [items]);
  const act = (id: string, action: MediaAction) => run("/api/admin/media", "PATCH", { ids: [id], action });

  return (
    <div className="flex flex-col gap-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-2">
        {items.map((m, i) => (
          <li key={m.id} className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 rounded-[24px] border border-[#E6E8EF] p-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <Thumb item={m} onOpen={() => setOpen(i)} label={t("media.open", { name: m.guestName || t("common.unknownGuest") })} />
            <div className="flex min-w-0 flex-col gap-2">
              <Link href={`/admin/events/${m.occasionId}`} className="truncate text-[15px] font-black text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">
                {m.occasionTitle}
              </Link>
              <span className="text-[13px] text-text-2">{m.guestName || t("common.unknownGuest")} · {formatDateTime(m.createdAt, locale)}</span>
              <Tags item={m} />
              {m.reportCount ? (
                <div className="flex flex-col gap-1 rounded-2xl bg-[#FDECEC] px-3 py-2 text-[13px] text-[#8A1C1C]">
                  <strong>{t("moderation.reports", { n: m.reportCount })}</strong>
                  {m.reasons?.length ? <ul className="m-0 list-disc pl-4">{m.reasons.map((r, k) => <li key={k} className="break-words">{r}</li>)}</ul> : null}
                </div>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2">
                <Button variant="primary" disabled={busy} onClick={() => act(m.id, "approve")}><Check size={16} aria-hidden />{t("moderation.keep")}</Button>
                <Button variant="secondary" disabled={busy} onClick={() => act(m.id, "hide")}><EyeOff size={16} aria-hidden />{t("media.hide")}</Button>
                <Button variant="secondary" disabled={busy} className="border-[#B42318]! text-[#B42318]! hover:bg-[#B42318]! hover:text-white!" onClick={() => setConfirm({ kind: "delete", item: m })}>
                  <Trash2 size={16} aria-hidden />{t("media.delete")}
                </Button>
                {m.guestId ? (
                  <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ kind: "block", item: m })}><Ban size={16} aria-hidden />{t("moderation.blockGuest")}</Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {open !== null ? <Lightbox items={lb} index={open} onIndex={setOpen} onClose={() => setOpen(null)} labels={labels} downloadUrl={() => null} /> : null}
      <DeleteMediaDialog ids={confirm?.kind === "delete" ? [confirm.item.id] : null} onClose={closeConfirm}
        onConfirm={async (x) => { if (await run("/api/admin/media", "PATCH", { ids: x, action: "delete" })) setConfirm(null); }} busy={busy} />
      <Dialog open={confirm?.kind === "block"} onClose={closeConfirm} title={t("moderation.blockTitle", { name: confirm?.item.guestName || t("common.unknownGuest") })}>
        <p className="m-0 text-[15px] text-text-2">{t("moderation.blockBody")}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled={busy} onClick={async () => {
            if (confirm?.item.guestId && await run(`/api/admin/guests/${confirm.item.guestId}`, "POST", { action: "block" })) setConfirm(null);
          }}>{busy ? t("common.working") : t("moderation.blockConfirm")}</Button>
          <Button variant="secondary" onClick={closeConfirm} disabled={busy}>{t("common.cancel")}</Button>
        </div>
      </Dialog>
    </div>
  );
}

/** Guest list row actions (block / unblock). */
export function GuestBlockButton({ guestId, blocked, name }: { guestId: string; blocked: boolean; name: string }) {
  const t = useT("admin");
  const { run, busy, error } = useAdminRequest();
  const [confirm, setConfirm] = useState(false);
  const close = useCallback(() => setConfirm(false), []);
  if (blocked) {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="secondary" disabled={busy} onClick={() => run(`/api/admin/guests/${guestId}`, "POST", { action: "unblock" })}>{busy ? t("common.working") : t("guests.unblock")}</Button>
        {error ? <span role="alert" className="text-xs text-[#8A1C1C]">{error}</span> : null}
      </div>
    );
  }
  return (
    <>
      <Button variant="secondary" disabled={busy} onClick={() => setConfirm(true)}><Ban size={16} aria-hidden />{t("guests.block")}</Button>
      <Dialog open={confirm} onClose={close} title={t("moderation.blockTitle", { name })}>
        <p className="m-0 text-[15px] text-text-2">{t("moderation.blockBody")}</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled={busy} onClick={async () => { if (await run(`/api/admin/guests/${guestId}`, "POST", { action: "block" })) setConfirm(false); }}>
            {busy ? t("common.working") : t("moderation.blockConfirm")}
          </Button>
          <Button variant="secondary" onClick={close} disabled={busy}>{t("common.cancel")}</Button>
        </div>
      </Dialog>
    </>
  );
}
