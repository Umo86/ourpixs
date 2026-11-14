"use client";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { MediaItem } from "@/lib/api-types";

type Props = {
  items: MediaItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  /** processing: copies still being made; unavailable: no preview could be made (e.g. HEIC). */
  labels: { close: string; prev: string; next: string; download: string; by: (name: string) => string; processing?: string; unavailable?: string };
  /** Extra actions (host: favourite, hide, delete, set as cover). */
  actions?: (item: MediaItem) => ReactNode;
  downloadUrl?: (item: MediaItem) => string | null;
  /** Downloads locked (event not paid): the button stays visible and calls this instead (e.g. the pay prompt). */
  onDownloadLocked?: () => void;
  /** Async download (fetches a fresh signed link, or opens an offer). Wins over downloadUrl. Return false to hide the button. */
  onDownload?: (item: MediaItem) => void;
  canDownload?: (item: MediaItem) => boolean;
};

/** Full-screen viewer with keyboard (←/→/Esc) and swipe navigation. */
export function Lightbox({ items, index, onIndex, onClose, labels, actions, downloadUrl, onDownloadLocked, onDownload, canDownload }: Props) {
  const item = items[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const go = useCallback((d: number) => {
    const n = index + d;
    if (n >= 0 && n < items.length) onIndex(n);
  }, [index, items.length, onIndex]);

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!item) return null;
  // Never falls back to originalUrl: lists don't carry originals (they come from the download endpoints).
  const dl = onDownloadLocked || onDownload ? null : downloadUrl ? downloadUrl(item) : null;
  const showAsync = !!onDownload && !onDownloadLocked && (canDownload ? canDownload(item) : true);
  const note = item.processing === "failed" ? labels.unavailable : labels.processing;
  const btn = "inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky disabled:opacity-30";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.guestName ? labels.by(item.guestName) : undefined}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
      onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        if (start != null && end != null && Math.abs(end - start) > 50) go(end < start ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <span className="truncate text-sm font-bold">{item.guestName ? labels.by(item.guestName) : ""}</span>
        <div className="flex items-center gap-2">
          {actions?.(item)}
          {onDownloadLocked ? (
            <button type="button" className={btn} aria-label={labels.download} onClick={onDownloadLocked}>
              <Download size={20} aria-hidden />
            </button>
          ) : showAsync ? (
            <button type="button" className={btn} aria-label={labels.download} onClick={() => onDownload!(item)}>
              <Download size={20} aria-hidden />
            </button>
          ) : dl ? (
            <a href={dl} download className={btn} aria-label={labels.download} target="_blank" rel="noopener">
              <Download size={20} aria-hidden />
            </a>
          ) : null}
          <button ref={closeRef} type="button" className={btn} onClick={onClose} aria-label={labels.close}>
            <X size={22} aria-hidden />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16">
        {item.kind === "video" && item.playbackUrl ? (
          <video key={item.id} src={item.playbackUrl} poster={item.displayUrl ?? undefined} controls playsInline className="max-h-full max-w-full rounded-2xl" />
        ) : item.kind === "video" || !item.displayUrl ? (
          <div className="flex max-h-full max-w-full flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.displayUrl ? <img key={item.id} src={item.displayUrl} alt="" className="max-h-[70vh] max-w-full rounded-2xl object-contain" /> : <span aria-hidden className="block aspect-[4/5] w-[min(70vw,360px)] rounded-2xl bg-surface-2" />}
            {note ? <p role="status" className="m-0 max-w-md text-center text-sm text-muted-dark">{note}</p> : null}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.id} src={item.displayUrl} alt={item.guestName ? labels.by(item.guestName) : ""} className="max-h-full max-w-full rounded-2xl object-contain" />
        )}
        <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label={labels.prev} className={`${btn} absolute left-2 top-1/2 hidden -translate-y-1/2 sm:inline-flex`}>
          <ChevronLeft size={24} aria-hidden />
        </button>
        <button type="button" onClick={() => go(1)} disabled={index >= items.length - 1} aria-label={labels.next} className={`${btn} absolute right-2 top-1/2 hidden -translate-y-1/2 sm:inline-flex`}>
          <ChevronRight size={24} aria-hidden />
        </button>
      </div>
    </div>
  );
}
