"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Heart, Play, Plus } from "lucide-react";
import { Chip } from "@/components/app/Chip";
import { Lightbox } from "@/components/app/Lightbox";
import { Spinner } from "@/components/app/Spinner";
import { useLocale, useT } from "@/i18n/client";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatDateTime, formatDuration, initial, timeAgo } from "@/lib/client/format";
import type { MediaItem } from "@/lib/api-types";
import { useGuest } from "./GuestContext";
import { Title } from "./Title";
import { PurchaseCard, PurchaseDialog } from "./PurchaseOffer";
import { EmailOffer } from "./EmailOffer";
import { DemoWatermark } from "./DemoWatermark";
import { ProcessingTile } from "@/components/app/ProcessingTile";
import { useProcessingRefresh } from "@/components/app/useProcessingRefresh";

type F = { kind?: "video"; sort?: "top"; moment?: string };
const POLL_MS = 15000;

export function Feed() {
  const t = useT("guest");
  const { locale } = useLocale();
  const { slug, occasion: o, guest, path, api: url, uploader } = useGuest();
  const demo = slug === "demo";
  const [f, setF] = useState<F>({});
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [offer, setOffer] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(id);
  }, [note]);
  const sentinel = useRef<HTMLDivElement>(null);
  const req = useRef(0);
  const revealed = o.revealMode !== "next_morning" || (o.revealAt ? Date.now() >= new Date(o.revealAt).getTime() : false);

  const qs = useCallback((extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ ...f, ...extra }).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [f]);

  const load = useCallback(async (reset: boolean, c: string | null) => {
    const my = ++req.current;
    setLoading(true);
    try {
      const r = await api<{ items: MediaItem[]; nextCursor: string | null }>(`${url("/feed")}?${qs({ cursor: reset ? undefined : c ?? undefined })}`);
      if (my !== req.current) return;
      setItems((prev) => (reset ? r.items : [...prev, ...r.items.filter((i) => !prev.some((p) => p.id === i.id))]));
      setCursor(r.nextCursor);
      setError(null);
    } catch (e) {
      if (my === req.current) setError(errorMessage(t, e));
    } finally {
      if (my === req.current) setLoading(false);
    }
  }, [url, qs, t]);

  useEffect(() => { setItems([]); setCursor(null); void load(true, null); }, [f, load]);

  // Live: poll for newer items (only on the default "newest" view).
  useEffect(() => {
    if (f.sort === "top") return;
    const id = setInterval(async () => {
      if (document.hidden) return;
      const newest = items[0]?.createdAt;
      if (!newest) { void load(true, null); return; }
      try {
        const r = await api<{ items: MediaItem[] }>(`${url("/feed")}?${qs({ after: newest })}`);
        if (r.items.length) setItems((prev) => [...r.items.filter((i) => !prev.some((p) => p.id === i.id)), ...prev]);
      } catch { /* keep quiet; next tick retries */ }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [items, f.sort, url, qs, load]);

  useEffect(() => uploader.onDone(() => setTimeout(() => void load(true, null), 800)), [uploader, load]);
  // New shots show as "getting ready" until their previews exist; swap them in when they do.
  useProcessingRefresh(items, async () => (await api<{ items: MediaItem[] }>(`${url("/feed")}?${qs({})}`)).items, setItems);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && cursor && !loading) void load(false, cursor); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loading, load]);

  async function react(m: MediaItem) {
    setItems((prev) => prev.map((i) => (i.id === m.id ? { ...i, reactedByMe: !i.reactedByMe, reactionCount: i.reactionCount + (i.reactedByMe ? -1 : 1) } : i)));
    try {
      const r = await api<{ reacted: boolean; count: number }>(url("/reactions"), { body: { mediaId: m.id } });
      setItems((prev) => prev.map((i) => (i.id === m.id ? { ...i, reactedByMe: r.reacted, reactionCount: r.count } : i)));
    } catch {
      setItems((prev) => prev.map((i) => (i.id === m.id ? { ...i, reactedByMe: m.reactedByMe, reactionCount: m.reactionCount } : i)));
    }
  }

  async function report(m: MediaItem) {
    const reason = window.prompt(t("feed.reportPrompt"));
    if (reason === null) return;
    try {
      await api(url("/report"), { body: { mediaId: m.id, reason } });
      setItems((prev) => prev.filter((i) => i.id !== m.id));
      setOpen(null);
      window.alert(t("feed.reported"));
    } catch (e) {
      window.alert(errorMessage(t, e));
    }
  }

  /**
   * Download: own uploads (free) and, after buying, everyone's: a fresh signed link to the original. Other people's
   * photos without a purchase open the "download everything" offer instead.
   */
  async function download(m: MediaItem) {
    if (!m.mine && !o.guestDownload.purchased) { setOffer(true); return; }
    try {
      const r = await api<{ url: string }>(url(`/media/${m.id}/download`));
      window.location.assign(r.url);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "purchase_required") setOffer(true);
      else setNote(errorMessage(t, e));
    }
  }
  const processingLabel = (m: MediaItem) => (m.processing === "failed" ? t("feed.unavailable") : t("feed.processing"));

  const day = o.days.find((d) => d.date === new Date().toISOString().slice(0, 10));
  const hero = items[0];
  const rest = items.slice(1);
  const likeBtn = (m: MediaItem, dark = true) => (
    <button type="button" aria-pressed={!!m.reactedByMe} aria-label={t("feed.love")} onClick={() => react(m)}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${m.reactedByMe ? "bg-royal text-white" : dark ? "bg-surface-2 text-white" : "bg-white/15 text-white"}`}>
      <Heart size={18} aria-hidden fill={m.reactedByMe ? "currentColor" : "none"} />{m.reactionCount}
    </button>
  );

  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5">
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-xs text-[#A8ACB8]">{t("feed.hi", { name: guest?.displayName || "" })}{day ? ` · ${day.name}` : ""}</span>
          <h1 className="m-0 truncate text-[26px] font-black tracking-[-0.04em]"><Title text={o.title} /></h1>
        </div>
        <span className="flex flex-none items-center gap-2 rounded-full bg-surface px-3.5 py-2.5 text-[13px] font-bold">
          <span aria-hidden className={`h-2 w-2 rounded-full bg-sky ${revealed ? "live-dot" : ""}`} />{revealed ? t("feed.live") : t("feed.later")}
        </span>
      </header>

      <div role="group" aria-label={t("feed.filters")} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip tone="dark" pressed={!f.kind && !f.sort && !f.moment} onClick={() => setF({})}>{t("feed.all")}</Chip>
        <Link href={`${path}/mine`} className="inline-flex min-h-11 flex-none items-center whitespace-nowrap rounded-full border-[1.5px] border-[#3A3F52] px-4 text-[13px] font-bold text-white no-underline hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">{t("feed.mine")}</Link>
        <Chip tone="dark" pressed={f.kind === "video"} onClick={() => setF((x) => ({ ...x, kind: x.kind ? undefined : "video" }))}>{t("feed.videos")}</Chip>
        <Chip tone="dark" pressed={f.sort === "top"} onClick={() => setF((x) => ({ ...x, sort: x.sort ? undefined : "top" }))}>{t("feed.top")}</Chip>
        {o.moments.map((m) => (
          <Chip key={m} tone="dark" pressed={f.moment === m} onClick={() => setF((x) => ({ ...x, moment: x.moment === m ? undefined : m }))}>{m}</Chip>
        ))}
      </div>

      {!revealed ? (
        <div className="flex flex-col items-start gap-3 rounded-[28px] bg-royal p-6">
          <span className="rotate-[-3deg] rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-royal">{t("feed.revealSticker")}</span>
          <p className="m-0 text-2xl font-black leading-tight tracking-tight">{o.revealAt ? t("feed.revealAt", { time: formatDateTime(o.revealAt, locale, o.timeZone) }) : t("feed.revealMorning")}</p>
          <p className="m-0 text-[15px] text-[#E3E8FF]">{t("feed.revealBody")}</p>
        </div>
      ) : null}

      {revealed ? <PurchaseCard /> : null}
      <EmailOffer />

      {error ? <p role="alert" className="m-0 rounded-2xl bg-surface p-4 text-sm">{error} <button type="button" className="font-bold underline" onClick={() => load(true, null)}>{t("common.retry")}</button></p> : null}

      {revealed && !loading && !error && !items.length ? (
        <div className="flex flex-col items-center gap-4 rounded-[28px] bg-surface px-6 py-12 text-center">
          <p className="m-0 text-2xl font-black tracking-tight">{t("feed.emptyTitle")} <span className="font-serif font-normal text-sky-soft">{t("feed.emptyAccent")}</span></p>
          <p className="m-0 text-muted-dark">{t("feed.emptyBody")}</p>
          <Link href={`${path}/upload`} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-royal px-6 font-extrabold text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><Plus size={20} aria-hidden />{t("feed.emptyCta")}</Link>
        </div>
      ) : null}

      {hero ? (
        <article className="overflow-hidden rounded-[28px] bg-surface">
          <button type="button" onClick={() => setOpen(0)} className="relative block w-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky" aria-label={hero.guestName ? t("feed.by", { name: hero.guestName }) : t("feed.open")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {hero.displayUrl ? <img src={hero.displayUrl} alt="" className="max-h-[70vh] w-full object-cover" style={{ aspectRatio: hero.width && hero.height ? `${hero.width}/${hero.height}` : "4/5" }} /> : <span className="block aspect-[4/5]"><ProcessingTile failed={hero.processing === "failed"} label={processingLabel(hero)} /></span>}
            <span className="absolute inset-x-3.5 top-3.5 flex justify-between gap-2">
              {hero.momentTag ? <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink">{hero.momentTag}</span> : <span />}
              <span suppressHydrationWarning className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold">{timeAgo(hero.createdAt, locale)}</span>
            </span>
            {demo && hero.displayUrl && !hero.mine ? <DemoWatermark brand={o.brand} /> : null}
            {hero.kind === "video" ? <span className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/55"><Play size={28} fill="currentColor" aria-hidden /></span> : null}
            {o.liveWall ? <span className="absolute bottom-3.5 left-3.5 rotate-[-3deg] rounded-full bg-royal px-3 py-1.5 text-xs font-bold">{t("feed.onWall")}</span> : null}
          </button>
          <div className="flex items-center justify-between gap-2.5 px-3.5 py-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-royal text-sm font-extrabold">{initial(hero.guestName)}</span>
              <span className="truncate text-[15px] font-bold">{hero.guestName || t("feed.hosts")}</span>
            </span>
            <span className="flex gap-2">
              {likeBtn(hero)}
              <button type="button" onClick={() => download(hero)} aria-label={t("feed.download")} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><Download size={18} aria-hidden /></button>
            </span>
          </div>
        </article>
      ) : null}

      {rest.length ? (
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
          {rest.map((m, i) => (
            <li key={m.id} className="relative aspect-square overflow-hidden rounded-2xl bg-surface-2 [content-visibility:auto] [contain-intrinsic-size:120px]">
              <button type="button" onClick={() => setOpen(i + 1)} aria-label={m.guestName ? t("feed.by", { name: m.guestName }) : t("feed.open")} className="block h-full w-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.thumbUrl ? <img src={m.thumbUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <ProcessingTile failed={m.processing === "failed"} label={processingLabel(m)} />}
                {demo && m.thumbUrl && !m.mine ? <DemoWatermark brand={o.brand} size="sm" /> : null}
                {m.kind === "video" ? <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] font-bold"><Play size={9} fill="currentColor" aria-hidden />{formatDuration(m.durationS)}</span> : null}
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-1.5 text-[11px] font-bold">
                  <span className="truncate">{m.guestName}</span>
                  {m.reactionCount ? <span className="flex items-center gap-0.5"><Heart size={10} fill="currentColor" aria-hidden />{m.reactionCount}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div ref={sentinel} aria-hidden className="h-2" />
      {loading ? <div className="flex justify-center py-6 text-muted-dark"><Spinner label={t("common.loading")} /></div> : null}

      {open !== null && items[open] ? (
        <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
          labels={{ close: t("common.close"), prev: t("common.previous"), next: t("common.next"), download: t("feed.download"), by: (n) => t("feed.by", { name: n }), processing: t("feed.processingLong"), unavailable: t("feed.unavailable") }}
          onDownload={download}
          actions={(m) => (
            <>
              {likeBtn(m, false)}
              <button type="button" onClick={() => report(m)} className="inline-flex min-h-11 items-center rounded-full bg-white/10 px-3.5 text-sm font-bold text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">{t("feed.report")}</button>
            </>
          )} />
      ) : null}
      <PurchaseDialog open={offer} onClose={() => setOffer(false)} />
      {note ? <div role="status" className="fixed bottom-28 left-1/2 z-[60] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-white px-5 py-3 text-center text-sm font-bold text-ink shadow-xl">{note}</div> : null}
    </main>
  );
}
