"use client";
import { useRef, useState } from "react";
import { Download, Play, X } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";
import { formatBytes, formatDate, formatDuration } from "@/lib/client/format";
import { openSaveTarget, safeName, saveZip, type ZipEntry } from "@/lib/client/zip";
import type { MediaItem } from "@/lib/api-types";
import type { PurchaseSummary } from "@/lib/purchase-rules";
import { ProcessingTile } from "@/components/app/ProcessingTile";

type ManifestFile = { id: string; name: string; url: string; dayId: string | null; createdAt: string };

/**
 * What a guest bought with "download everything": one ZIP (or one per day when it's over ~2 GB), plus every item on
 * its own. Each click asks the server for FRESH signed links (1 h); originals are never part of the page itself.
 * `manifestUrl` = …/purchase/files (device) or /api/v1/d/<token>/files (emailed link);
 * an item's link comes from `${itemPrefix}${id}${itemSuffix}`.
 */
export function PurchaseDownloads({ title, expiresAt, summary, manifestUrl, itemPrefix, itemSuffix, items, more }: {
  title: string; expiresAt: string | null; summary: PurchaseSummary; manifestUrl: string; itemPrefix: string; itemSuffix: string;
  items: MediaItem[]; more: boolean;
}) {
  const t = useT("guest");
  const { locale } = useLocale();
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ files: number; totalFiles: number } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const dayName = (id: string | null) => summary.days.find((d) => d.id === id)?.name || t("download.otherDay");

  async function zip(key: string, dayId: string | null | undefined) {
    const label = dayId !== undefined ? dayName(dayId) : "";
    const filename = `${safeName(title)}${label ? ` - ${safeName(label)}` : ""}.zip`;
    setMessage(null);
    let target: WritableStream<Uint8Array> | null = null;
    try {
      target = await openSaveTarget(filename);
    } catch {
      return; // save dialog cancelled
    }
    setRunning(key);
    setProgress({ files: 0, totalFiles: 0 });
    abort.current = new AbortController();
    try {
      const q = dayId === undefined ? "" : `?dayId=${dayId ?? "none"}`;
      const { files } = await api<{ files: ManifestFile[] }>(`${manifestUrl}${q}`);
      if (!files.length) {
        setMessage({ ok: false, text: t("download.nothing") });
        await target?.abort().catch(() => {});
        return;
      }
      const folders = dayId === undefined && summary.days.length > 1;
      const entries: ZipEntry[] = files.map((f) => ({ name: folders ? `${safeName(dayName(f.dayId))}/${f.name}` : f.name, url: f.url, lastModified: new Date(f.createdAt) }));
      setProgress({ files: 0, totalFiles: entries.length });
      await saveZip(entries, filename, (p) => setProgress({ files: p.files, totalFiles: p.totalFiles }), { signal: abort.current.signal, target });
      setMessage({ ok: true, text: t("download.saved") });
    } catch (e) {
      await target?.abort().catch(() => {});
      if ((e as Error).name !== "AbortError") setMessage({ ok: false, text: errorMessage(t, e) });
    } finally {
      setRunning(null);
      abort.current = null;
    }
  }

  async function one(m: MediaItem) {
    try {
      const r = await api<{ url: string }>(`${itemPrefix}${m.id}${itemSuffix}`);
      window.location.assign(r.url);
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(t, e) });
    }
  }

  const pct = progress && progress.totalFiles ? Math.round((progress.files / progress.totalFiles) * 100) : 0;
  const pill = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky disabled:opacity-50";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-[28px] bg-royal p-6">
        <span className="rotate-[-3deg] self-start rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-royal">{t("download.sticker")}</span>
        <p className="m-0 text-[15px] text-[#E3E8FF]">{t("download.counts", { photos: summary.photos, videos: summary.videos, size: formatBytes(summary.bytes, locale) })}</p>
        {expiresAt ? <p className="m-0 text-sm font-bold">{t("download.until", { date: formatDate(expiresAt, locale) })}</p> : null}
        {!summary.split ? (
          <button type="button" disabled={!!running} onClick={() => zip("all", undefined)} className={`${pill} mt-2 self-start bg-white text-royal`}>
            <Download size={18} aria-hidden />{t("download.everything")}
          </button>
        ) : <p className="m-0 mt-1 rounded-2xl bg-white/15 p-3 text-sm">{t("download.splitHint")}</p>}
      </div>

      {summary.days.length > 1 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {summary.days.map((d) => (
            <li key={d.id ?? "none"} className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-surface p-4">
              <span className="flex flex-col">
                <span className="font-black">{d.name || t("download.otherDay")}</span>
                <span className="text-sm text-muted-dark">{t("download.dayCounts", { n: d.count, size: formatBytes(d.bytes, locale) })}</span>
              </span>
              <button type="button" disabled={!!running} onClick={() => zip(d.id ?? "none", d.id)} className={`${pill} bg-surface-2 text-white`}>
                <Download size={18} aria-hidden />{t("download.zip")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {running && progress ? (
        <div className="flex flex-col gap-3 rounded-[24px] border-2 border-sky p-5" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold">{progress.totalFiles ? t("download.progress", { done: progress.files, total: progress.totalFiles }) : t("download.preparing")}</span>
            <button type="button" onClick={() => abort.current?.abort()} className={`${pill} min-h-11 bg-surface-2 px-4 text-sm text-white`}><X size={16} aria-hidden />{t("common.cancel")}</button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-sky transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm text-muted-dark">{t("download.keepOpen")}</span>
        </div>
      ) : null}
      {message ? <p role={message.ok ? "status" : "alert"} className="m-0 rounded-2xl bg-surface p-4 text-sm font-bold">{message.text}</p> : null}

      <section aria-labelledby="dl-items" className="flex flex-col gap-3">
        <h2 id="dl-items" className="m-0 text-xl font-black tracking-tight">{t("download.oneByOne")}</h2>
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4">
          {items.map((m) => (
            <li key={m.id} className="relative aspect-square overflow-hidden rounded-2xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.thumbUrl ? <img src={m.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ProcessingTile failed={m.processing === "failed"} label={m.processing === "failed" ? t("feed.unavailable") : t("feed.processing")} />}
              {m.kind === "video" ? <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] font-bold"><Play size={9} fill="currentColor" aria-hidden />{formatDuration(m.durationS)}</span> : null}
              <button type="button" onClick={() => one(m)} aria-label={m.guestName ? t("download.oneBy", { name: m.guestName }) : t("download.one")}
                className="absolute bottom-1.5 right-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">
                <Download size={18} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {more ? <p className="m-0 text-sm text-muted-dark">{t("download.more")}</p> : null}
      </section>
      <p className="m-0 text-sm text-muted-dark">{t("download.browserNote")}</p>
    </div>
  );
}
