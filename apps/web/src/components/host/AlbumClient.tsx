"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckSquare, Download, Eye, EyeOff, ImagePlus, Play, Star, Trash2, X, ImageIcon, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { Chip } from "@/components/app/Chip";
import { Lightbox } from "@/components/app/Lightbox";
import { Notice } from "@/components/app/Notice";
import { Spinner } from "@/components/app/Spinner";
import { useT } from "@/i18n/client";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatDuration } from "@/lib/client/format";
import { Uploader } from "@/lib/client/uploader";
import { openSaveTarget, safeName, saveZip } from "@/lib/client/zip";
import { ProcessingTile } from "@/components/app/ProcessingTile";
import { useProcessingRefresh } from "@/components/app/useProcessingRefresh";
import type { MediaItem } from "@/lib/api-types";
import { DownloadLockedDialog } from "./EventPackage";

type Filters = { dayId?: string; moment?: string; guestId?: string; kind?: "photo" | "video"; filter?: "favourites" | "hidden" | "pending" | "flagged" | "duplicates" | "blurry" };
type Action = "hide" | "show" | "delete" | "favourite" | "unfavourite" | "approve";

type Props = {
  occasionId: string;
  days: { id: string; name: string }[];
  moments: { value: string; label: string }[];
  guests: { id: string; name: string }[];
  pendingCount: number;
  approvalMode: boolean;
  /** The event package: downloads locked before paying; uploads closed while read-only. */
  canDownload: boolean;
  canUpload: boolean;
  isOwner: boolean;
  payments: boolean;
  /** Longest video (admin setting); checked in the browser before uploading. */
  videoMaxSeconds: number;
  /** Test mode upload limit (before paying), for the error copy. */
  testUploadLimit: number;
  pricePence: number;
  canPay: boolean;
};

const uploaders = new Map<string, Uploader>();
function hostUploader(id: string, maxVideoSeconds: number) {
  let u = uploaders.get(id);
  if (!u) {
    u = new Uploader({ ns: `host:${id}`, createUrl: `/api/v1/occasions/${id}/uploads`, completeUrl: `/api/v1/occasions/${id}/uploads/complete`, maxVideoSeconds });
    uploaders.set(id, u);
  }
  return u;
}

export function AlbumClient({ occasionId, days, moments, guests, pendingCount, approvalMode, canDownload, canUpload, isOwner, payments, videoMaxSeconds, testUploadLimit, pricePence, canPay }: Props) {
  const t = useT("host");
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({});
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const uploader = useMemo(() => hostUploader(occasionId, videoMaxSeconds), [occasionId, videoMaxSeconds]);
  const queue = useSyncExternalStore(uploader.subscribe, uploader.getSnapshot, () => []);
  const activeUploads = queue.filter((q) => q.status !== "done" && q.status !== "error").length;
  const failedUploads = queue.filter((q) => q.status === "error");

  const qs = useCallback((c?: string | null) => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    if (c) p.set("cursor", c);
    return p.toString();
  }, [filters]);

  const load = useCallback(async (reset: boolean) => {
    const my = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ items: MediaItem[]; nextCursor: string | null }>(`/api/v1/occasions/${occasionId}/media?${qs(reset ? null : cursor)}`);
      if (my !== reqId.current) return;
      setItems((prev) => (reset ? r.items : [...prev, ...r.items.filter((i) => !prev.some((p) => p.id === i.id))]));
      setCursor(r.nextCursor);
    } catch (e) {
      if (my === reqId.current) setError(errorMessage(t, e));
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  }, [occasionId, qs, cursor, t]);
  // Videos (and photos the browser couldn't preview) show "processing" until the server copies exist.
  useProcessingRefresh(items, async () => (await api<{ items: MediaItem[] }>(`/api/v1/occasions/${occasionId}/media?${qs(null)}`)).items, setItems);

  // Reload from the top whenever filters change.
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setSelected(new Set());
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && cursor && !loading) void load(false);
    }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loading, load]);

  useEffect(() => {
    void uploader.restore();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = uploader.onDone(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void load(true); router.refresh(); }, 1200);
    });
    return () => { off(); if (timer) clearTimeout(timer); };
  }, [uploader, load, router]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const setF = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  async function act(ids: string[], action: Action) {
    if (!ids.length) return;
    if (action === "delete" && !window.confirm(t("album.confirmDelete", { n: ids.length }))) return;
    setBusy(true);
    try {
      await api(`/api/v1/occasions/${occasionId}/media`, { method: "PATCH", body: { ids, action } });
      const removes = action === "delete" || (action === "hide" && filters.filter !== "hidden") || (action === "show" && filters.filter === "hidden") || (action === "approve" && filters.filter === "pending") || (action === "unfavourite" && filters.filter === "favourites");
      setItems((prev) => removes ? prev.filter((i) => !ids.includes(i.id)) : prev.map((i) => ids.includes(i.id) ? {
        ...i,
        favourite: action === "favourite" ? true : action === "unfavourite" ? false : i.favourite,
        visibility: action === "hide" ? "hidden" : action === "show" ? "visible" : i.visibility,
        approved: action === "approve" ? true : i.approved,
      } : i));
      setSelected(new Set());
      setToast(t(`album.done.${action}`, { n: ids.length }));
      if (removes) setOpen(null);
      router.refresh();
    } catch (e) {
      setToast(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  async function hideMatching(match: "duplicates" | "blurry") {
    if (!window.confirm(t("album.confirmHideMatching"))) return;
    setBusy(true);
    try {
      await api(`/api/v1/occasions/${occasionId}/media`, { method: "PATCH", body: { match, action: "hide" } });
      setItems([]);
      setToast(t("album.hiddenMatching"));
      void load(true);
      router.refresh();
    } catch (e) {
      setToast(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  async function blockGuest(guestId: string) {
    if (!window.confirm(t("album.confirmBlock"))) return;
    setBusy(true);
    try {
      await api(`/api/v1/occasions/${occasionId}/guests/${guestId}/block`, { body: {} });
      setToast(t("album.blocked"));
      setFilters({});
      router.refresh();
    } catch (e) {
      setToast(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  async function setCover(id: string) {
    try {
      await api(`/api/v1/occasions/${occasionId}`, { method: "PATCH", body: { coverMediaId: id } });
      setToast(t("album.coverSet"));
    } catch (e) {
      setToast(errorMessage(t, e));
    }
  }

  /** Originals never come with the album list: the server mints fresh signed links for the selection. */
  async function downloadSelected() {
    if (!canDownload) { setLocked(true); return; }
    const chosen = items.filter((i) => selected.has(i.id) && i.kind !== "voice");
    if (!chosen.length) return;
    const filename = `${safeName(t("album.zipName"))}-${chosen.length}.zip`;
    let target: WritableStream<Uint8Array> | null = null;
    try {
      target = await openSaveTarget(filename);
      setZipping(t("download.preparing"));
      const { files } = await api<{ files: { name: string; url: string; createdAt: string }[] }>(`/api/v1/occasions/${occasionId}/download`, { body: { ids: chosen.map((i) => i.id) } });
      setZipping(t("download.progress", { done: 0, total: files.length }));
      await saveZip(files.map((f) => ({ name: f.name, url: f.url, lastModified: new Date(f.createdAt) })), filename,
        (p) => setZipping(t("download.progress", { done: p.files, total: p.totalFiles })), { target });
      setToast(t("download.saved"));
    } catch (e) {
      await target?.abort().catch(() => {});
      if (e instanceof ApiClientError && e.code === "payment_required") setLocked(true);
      else if ((e as Error).name !== "AbortError") setToast(t("errors.generic"));
    } finally {
      setZipping(null);
    }
  }

  /** One original: a fresh signed link (1 h) from the server. */
  async function downloadOne(m: MediaItem) {
    if (!canDownload) { setLocked(true); return; }
    try {
      const r = await api<{ url: string }>(`/api/v1/occasions/${occasionId}/media/${m.id}/download`);
      window.location.assign(r.url);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "payment_required") setLocked(true);
      else setToast(errorMessage(t, e));
    }
  }

  const lbLabels = { close: t("common.close"), prev: t("common.previous"), next: t("common.next"), download: t("common.download"), by: (n: string) => t("album.by", { name: n }), processing: t("album.processingLong"), unavailable: t("album.unavailable") };
  const iconBtn = "inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";
  const select = "min-h-10 rounded-full border-[1.5px] border-[#D5D8E2] bg-white px-4 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));

  return (
    <section aria-label={t("album.title")} className="flex flex-col gap-5">
      {pendingCount > 0 && filters.filter !== "pending" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-royal px-5 py-4 text-white">
          <span className="text-[15px]"><span className="font-serif text-xl">{t("album.pendingCount", { n: pendingCount })}</span> {t("album.pendingBody")}</span>
          <Button variant="light" onClick={() => setF({ filter: "pending" })}>{t("album.review")}</Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t("album.filters")} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip pressed={!filters.dayId && !filters.kind && !filters.filter} onClick={() => setFilters({ moment: filters.moment, guestId: filters.guestId })}>{t("album.all")}</Chip>
          {days.length > 1 ? days.map((d) => (
            <Chip key={d.id} pressed={filters.dayId === d.id} onClick={() => setF({ dayId: filters.dayId === d.id ? undefined : d.id })}>{d.name}</Chip>
          )) : null}
          <Chip pressed={filters.kind === "photo"} onClick={() => setF({ kind: filters.kind === "photo" ? undefined : "photo" })}>{t("album.photos")}</Chip>
          <Chip pressed={filters.kind === "video"} onClick={() => setF({ kind: filters.kind === "video" ? undefined : "video" })}>{t("album.videos")}</Chip>
          <Chip pressed={filters.filter === "favourites"} onClick={() => setF({ filter: filters.filter === "favourites" ? undefined : "favourites" })}>{t("album.favourites")}</Chip>
          {(approvalMode || pendingCount > 0) ? (
            <Chip pressed={filters.filter === "pending"} onClick={() => setF({ filter: filters.filter === "pending" ? undefined : "pending" })}>{t("album.pending")}{pendingCount ? ` · ${pendingCount}` : ""}</Chip>
          ) : null}
          <Chip pressed={filters.filter === "hidden"} onClick={() => setF({ filter: filters.filter === "hidden" ? undefined : "hidden" })}>{t("album.hidden")}</Chip>
          <Chip pressed={filters.filter === "flagged"} onClick={() => setF({ filter: filters.filter === "flagged" ? undefined : "flagged" })}>{t("album.flagged")}</Chip>
          <Chip pressed={filters.filter === "duplicates"} onClick={() => setF({ filter: filters.filter === "duplicates" ? undefined : "duplicates" })}>{t("album.duplicates")}</Chip>
          <Chip pressed={filters.filter === "blurry"} onClick={() => setF({ filter: filters.filter === "blurry" ? undefined : "blurry" })}>{t("album.blurry")}</Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="f-moment">{t("album.moment")}</label>
          <select id="f-moment" className={select} value={filters.moment || ""} onChange={(e) => setF({ moment: e.target.value || undefined })}>
            <option value="">{t("album.anyMoment")}</option>
            {moments.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {guests.length ? (
            <>
              <label className="sr-only" htmlFor="f-guest">{t("album.guest")}</label>
              <select id="f-guest" className={`${select} max-w-48`} value={filters.guestId || ""} onChange={(e) => setF({ guestId: e.target.value || undefined })}>
                <option value="">{t("album.anyGuest")}</option>
                {guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={selecting ? "dark" : "secondary"} onClick={() => { setSelecting((s) => !s); setSelected(new Set()); }}>
          <CheckSquare size={18} aria-hidden />{selecting ? t("album.doneSelecting") : t("album.select")}
        </Button>
        {selecting ? (
          <Button variant="secondary" onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}>{allSelected ? t("album.selectNone") : t("album.selectAll")}</Button>
        ) : null}
        <Button variant="secondary" disabled={!canUpload} onClick={() => fileInput.current?.click()}><ImagePlus size={18} aria-hidden />{t("album.addPhotos")}</Button>
        <input ref={fileInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) uploader.add(files, { dayId: filters.dayId });
          e.target.value = "";
        }} />
        {activeUploads ? <span className="text-sm font-semibold text-royal"><Spinner label={t("album.uploading", { n: activeUploads })} /></span> : null}
        {failedUploads.length ? (
          <button type="button" className="min-h-11 text-sm font-semibold text-[#8A1C1C] underline" onClick={() => failedUploads.forEach((f) => uploader.retry(f.id))}>
            {t("album.uploadFailed", { n: failedUploads.length })}
          </button>
        ) : null}
      </div>
      {failedUploads.length ? (() => {
        // Errors the host has to act on (video too long, test limit…), each once.
        const vars = { seconds: videoMaxSeconds, limit: testUploadLimit };
        const msgs = [...new Set(failedUploads.map((f) => (f.errorCode ? t(`errors.${f.errorCode}`, vars) : "")).filter((m, i) => m && !m.startsWith("errors.") && failedUploads[i]?.errorCode !== "offline"))];
        return msgs.length ? <Notice tone="error">{msgs.join(" ")}</Notice> : null;
      })() : null}

      {filters.filter === "duplicates" || filters.filter === "blurry" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-tint px-5 py-4">
          <span className="text-[15px]">{filters.filter === "duplicates" ? t("album.duplicatesHint") : t("album.blurryHint")}</span>
          <Button variant="secondary" disabled={busy || !items.length} onClick={() => hideMatching(filters.filter as "duplicates" | "blurry")}><EyeOff size={18} aria-hidden />{filters.filter === "duplicates" ? t("album.hideAllDuplicates") : t("album.hideAllBlurry")}</Button>
        </div>
      ) : null}
      {filters.guestId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-tint px-5 py-4">
          <span className="text-[15px]">{t("album.guestTools", { name: guests.find((g) => g.id === filters.guestId)?.name || "" })}</span>
          <Button variant="secondary" disabled={busy} onClick={() => blockGuest(filters.guestId!)}>{t("album.blockGuest")}</Button>
        </div>
      ) : null}

      {error ? <Notice tone="error">{error} <button type="button" className="font-bold underline" onClick={() => load(true)}>{t("common.retry")}</button></Notice> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[28px] bg-tint px-6 py-16 text-center">
          <ImageIcon size={36} aria-hidden className="text-royal" />
          <p className="m-0 text-xl font-extrabold">{Object.keys(filters).some((k) => filters[k as keyof Filters]) ? t("album.emptyFiltered") : t("album.empty")}</p>
          <p className="m-0 max-w-md text-muted">{t("album.emptyHint")}</p>
        </div>
      ) : null}

      <ul className="m-0 grid list-none grid-cols-3 gap-1 p-0 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((m, i) => {
          const isSel = selected.has(m.id);
          return (
            <li key={m.id} className="relative aspect-square overflow-hidden rounded-xl bg-surface [content-visibility:auto] [contain-intrinsic-size:200px]">
              <button
                type="button"
                onClick={() => (selecting ? toggle(m.id) : setOpen(i))}
                aria-pressed={selecting ? isSel : undefined}
                aria-label={m.guestName ? t("album.by", { name: m.guestName }) : t("album.byHost")}
                className="group block h-full w-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky"
              >
                {m.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbUrl} alt="" loading="lazy" decoding="async" className={`h-full w-full object-cover transition-transform group-hover:scale-105 ${m.visibility === "hidden" ? "opacity-40" : ""}`} />
                ) : <ProcessingTile tone="light" failed={m.processing === "failed"} label={m.processing === "failed" ? t("album.unavailable") : t("album.processing")} />}
                {m.kind === "video" && m.processing === "pending" && m.thumbUrl ? <span className="absolute bottom-8 left-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white">{t("album.processing")}</span> : null}
                {m.kind === "video" ? <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white"><Play size={10} aria-hidden fill="currentColor" />{formatDuration(m.durationS)}</span> : null}
                {m.favourite ? <Star size={16} aria-hidden className="absolute left-1.5 top-1.5 fill-white text-white drop-shadow" /> : null}
                {m.approved === false ? <span className="absolute bottom-1.5 left-1.5 rounded-full bg-royal px-2 py-0.5 text-[11px] font-bold text-white">{t("album.pendingBadge")}</span> : null}
                {m.moderationFlags?.length ? <span className="absolute left-1.5 top-8 rounded-full bg-[#FFD84D] px-2 py-0.5 text-[10px] font-extrabold text-ink">{m.moderationFlags.map((f) => t(`album.flag.${f}`)).join(" · ")}</span> : null}
                {m.guestName ? <span className="absolute bottom-1.5 right-1.5 max-w-[70%] truncate rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">{m.guestName}</span> : null}
                {selecting ? (
                  <span aria-hidden className={`absolute inset-0 flex items-start justify-end p-1.5 ${isSel ? "bg-royal/35 ring-4 ring-inset ring-royal" : ""}`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white ${isSel ? "bg-royal" : "bg-black/30"}`}>{isSel ? <Check size={16} className="text-white" /> : null}</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div ref={sentinel} aria-hidden className="h-4" />
      {loading ? <div className="flex justify-center py-6 text-muted"><Spinner label={t("common.loading")} /></div> : null}

      {selecting && selected.size > 0 ? (
        <div className="sticky bottom-4 z-30 mx-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full bg-ink px-3 py-2 text-white shadow-2xl">
          <span className="px-2 text-sm font-bold">{t("album.selected", { n: selected.size })}</span>
          {filters.filter === "pending" || items.some((i) => selected.has(i.id) && i.approved === false) ? (
            <Button variant="light" disabled={busy} onClick={() => act([...selected], "approve")}><BadgeCheck size={18} aria-hidden />{t("album.approve")}</Button>
          ) : null}
          <Button variant="dark" disabled={busy} onClick={() => act([...selected], "favourite")} aria-label={t("album.favourite")}><Star size={18} aria-hidden /><span className="hidden sm:inline">{t("album.favourite")}</span></Button>
          {filters.filter === "hidden" ? (
            <Button variant="dark" disabled={busy} onClick={() => act([...selected], "show")}><Eye size={18} aria-hidden /><span className="hidden sm:inline">{t("album.show")}</span></Button>
          ) : (
            <Button variant="dark" disabled={busy} onClick={() => act([...selected], "hide")} aria-label={t("album.hide")}><EyeOff size={18} aria-hidden /><span className="hidden sm:inline">{t("album.hide")}</span></Button>
          )}
          <Button variant="dark" disabled={busy || !!zipping} onClick={downloadSelected} aria-label={t("common.download")}><Download size={18} aria-hidden /><span className="hidden sm:inline">{t("common.download")}</span></Button>
          <Button variant="dark" disabled={busy} onClick={() => act([...selected], "delete")} aria-label={t("common.delete")} className="text-[#FF8A8A]!"><Trash2 size={18} aria-hidden /></Button>
          <button type="button" onClick={() => setSelected(new Set())} aria-label={t("album.selectNone")} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"><X size={18} aria-hidden /></button>
        </div>
      ) : null}

      {open !== null && items[open] ? (
        <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} labels={lbLabels}
          onDownload={downloadOne} onDownloadLocked={canDownload ? undefined : () => setLocked(true)}
          actions={(m) => (
            <>
              {m.approved === false ? <button type="button" className={iconBtn} aria-label={t("album.approve")} onClick={() => act([m.id], "approve")}><BadgeCheck size={20} aria-hidden /></button> : null}
              <button type="button" className={iconBtn} aria-pressed={!!m.favourite} aria-label={m.favourite ? t("album.unfavourite") : t("album.favourite")} onClick={() => act([m.id], m.favourite ? "unfavourite" : "favourite")}>
                <Star size={20} aria-hidden className={m.favourite ? "fill-white" : ""} />
              </button>
              <button type="button" className={iconBtn} aria-label={m.visibility === "hidden" ? t("album.show") : t("album.hide")} onClick={() => act([m.id], m.visibility === "hidden" ? "show" : "hide")}>
                {m.visibility === "hidden" ? <Eye size={20} aria-hidden /> : <EyeOff size={20} aria-hidden />}
              </button>
              {m.kind === "photo" ? <button type="button" className={`${iconBtn} hidden w-auto px-4 text-sm font-bold sm:inline-flex`} onClick={() => setCover(m.id)}>{t("album.setCover")}</button> : null}
              <button type="button" className={iconBtn} aria-label={t("common.delete")} onClick={() => act([m.id], "delete")}><Trash2 size={20} aria-hidden /></button>
            </>
          )}
        />
      ) : null}

      <DownloadLockedDialog open={locked} onClose={() => setLocked(false)} isOwner={isOwner} payments={payments} occasionId={occasionId} pricePence={pricePence} canPay={canPay} />
      {zipping || toast ? (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white shadow-xl">{zipping || toast}</div>
      ) : null}
    </section>
  );
}
