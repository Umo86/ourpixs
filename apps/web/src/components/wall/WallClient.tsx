"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize } from "lucide-react";
import type { MediaItem } from "@/lib/api-types";

type Props = {
  slug: string; wallKey: string; title: string; qr: string; shortUrl: string;
  initial: MediaItem[]; initialStats: { photos: number; guests: number };
  brandName: string | null; logoUrl: string | null; accent: string;
  labels: { shareYours: string; shareYoursAccent: string; scan: string; stats: string; justNow: string; by: string; empty: string; fullscreen: string };
};

const POLL_MS = 5000;
const SLIDE_MS = 7000;
const MAX = 200;

/** Full-screen live slideshow: newest shots jump the queue, crossfade between slides, QR corner to join. */
export function WallClient({ slug, wallKey, title, qr, shortUrl, initial, initialStats, brandName, logoUrl, accent, labels }: Props) {
  const [items, setItems] = useState(initial);
  const [stats, setStats] = useState(initialStats);
  const [current, setCurrent] = useState<MediaItem | null>(initial[0] ?? null);
  const [previous, setPrevious] = useState<MediaItem | null>(null);
  const [fade, setFade] = useState(false);
  const fresh = useRef<string[]>([]);
  const cursor = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Poll for new uploads.
  useEffect(() => {
    const id = setInterval(async () => {
      const newest = itemsRef.current[0]?.createdAt;
      const qs = new URLSearchParams({ k: wallKey });
      if (newest) qs.set("after", newest);
      try {
        const r = await fetch(`/api/v1/wall/${slug}?${qs}`, { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { items: MediaItem[]; stats: { photos: number; guests: number } };
        setStats(data.stats);
        if (data.items.length) {
          setItems((prev) => {
            const add = data.items.filter((i) => !prev.some((p) => p.id === i.id));
            fresh.current.push(...add.map((a) => a.id).reverse());
            return [...add, ...prev].slice(0, MAX);
          });
        }
      } catch { /* network blip: keep showing what we have */ }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [slug, wallKey]);

  // Slideshow: fresh uploads first, then cycle through everything.
  useEffect(() => {
    const id = setInterval(() => {
      const list = itemsRef.current;
      if (!list.length) return;
      let next: MediaItem | undefined;
      while (fresh.current.length && !next) next = list.find((i) => i.id === fresh.current.shift());
      if (!next) {
        cursor.current = (cursor.current + 1) % list.length;
        next = list[cursor.current];
      }
      if (!next) return;
      const img = new Image();
      img.src = next.displayUrl || "";
      const go = () => {
        setCurrent((c) => { setPrevious(c); return next!; });
        setFade(false);
        requestAnimationFrame(() => requestAnimationFrame(() => setFade(true)));
      };
      img.onload = go;
      img.onerror = go;
    }, SLIDE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (!current && items[0]) setCurrent(items[0]); }, [items, current]);

  const tiles = items.filter((i) => i.id !== current?.id).slice(0, 5);
  const statLine = labels.stats.replace("{photos}", stats.photos.toLocaleString()).replace("{guests}", stats.guests.toLocaleString());
  const recent = current && Date.now() - new Date(current.createdAt).getTime() < 120000;

  return (
    <main className="fixed inset-0 grid grid-cols-4 grid-rows-3 gap-1 bg-ink text-white" aria-live="polite">
      <section className="relative col-span-2 row-span-3 overflow-hidden bg-surface">
        {previous?.displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`p-${previous.id}`} src={previous.displayUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        {current?.displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`c-${current.id}`} src={current.displayUrl} alt={current.guestName ? labels.by.replace("{name}", current.guestName) : ""}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ${fade || !previous ? "opacity-100" : "opacity-0"}`} />
        ) : null}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />
        <div className="absolute inset-0 flex flex-col justify-between p-[3vw]">
          <span className="text-[1vw] font-bold uppercase tracking-[0.3em]">{recent ? labels.justNow : ""}{current?.momentTag ? `${recent ? " · " : ""}${current.momentTag}` : ""}</span>
          <div className="flex flex-col gap-[0.8vw]">
            {current?.guestName ? <span className="font-serif text-[5vw] leading-none">{labels.by.replace("{name}", current.guestName)}</span> : null}
            <span className="text-[1vw] font-bold uppercase tracking-[0.3em] text-muted-dark">{title}</span>
          </div>
        </div>
        {!items.length ? <div className="absolute inset-0 flex items-center justify-center p-10 text-center text-[2.4vw] font-black">{labels.empty}</div> : null}
      </section>
      {Array.from({ length: 5 }, (_, i) => tiles[i]).map((m, i) => (
        <div key={m?.id ?? `empty-${i}`} className="relative overflow-hidden bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {m?.thumbUrl || m?.displayUrl ? <img src={m.displayUrl || m.thumbUrl || ""} alt="" className="h-full w-full object-cover" /> : null}
          {m?.guestName ? <span className="absolute bottom-[0.6vw] left-[0.6vw] rounded-full bg-black/60 px-[0.8vw] py-[0.3vw] text-[0.85vw] font-bold">{m.guestName}</span> : null}
        </div>
      ))}
      <aside className="flex items-center gap-[1.4vw] p-[1.6vw]" style={{ background: accent }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={labels.scan} className="aspect-square h-full max-h-[11vw] flex-none rounded-[0.8vw] bg-white p-[0.4vw]" />
        <div className="flex min-w-0 flex-col gap-[0.5vw]">
          <span className="text-[2.3vw] font-black leading-[0.95] tracking-[-0.04em]">{labels.shareYours} <span className="font-serif font-normal">{labels.shareYoursAccent}</span></span>
          <span className="truncate text-[0.8vw] font-bold uppercase tracking-[0.2em]">{shortUrl}</span>
          <span className="text-[0.8vw] font-bold uppercase tracking-[0.2em] text-[#DDE4FF]">{statLine}</span>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName || ""} className="mt-[0.4vw] h-[2vw] max-w-[10vw] object-contain object-left" />
          ) : brandName ? <span className="font-serif text-[1.2vw]">{brandName}</span> : null}
        </div>
      </aside>
      <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} aria-label={labels.fullscreen}
        className="fixed right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white opacity-40 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">
        <Maximize size={18} aria-hidden />
      </button>
    </main>
  );
}
