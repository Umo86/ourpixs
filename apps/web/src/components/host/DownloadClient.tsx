"use client";
import { useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Notice } from "@/components/app/Notice";
import { useT } from "@/i18n/client";
import { api } from "@/lib/client/api";
import { EXT, openSaveTarget, safeName, saveZip, type ZipEntry } from "@/lib/client/zip";
import type { MediaItem } from "@/lib/api-types";

type Day = { id: string; name: string };

async function fetchAll(occasionId: string, dayId: string | null): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  let cursor: string | null = null;
  do {
    const p = new URLSearchParams({ limit: "200" });
    if (dayId) p.set("dayId", dayId);
    if (cursor) p.set("cursor", cursor);
    const r: { items: MediaItem[]; nextCursor: string | null } = await api(`/api/v1/occasions/${occasionId}/media?${p}`);
    out.push(...r.items);
    cursor = r.nextCursor;
  } while (cursor);
  return out;
}

function entriesFor(items: MediaItem[], folder: string | null): ZipEntry[] {
  return items.filter((i) => i.originalUrl).reverse().map((i, n) => {
    const d = new Date(i.createdAt);
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
    const ext = EXT[i.mime || ""] || (i.kind === "video" ? "mp4" : "jpg");
    const name = `${stamp}_${String(n + 1).padStart(4, "0")}_${safeName(i.guestName || "host")}.${ext}`;
    return { name: folder ? `${safeName(folder)}/${name}` : name, url: i.originalUrl!, lastModified: d };
  });
}

/** Client-side streaming ZIP per day (or everything), straight from storage to disk. */
export function DownloadClient({ occasionId, title, days }: { occasionId: string; title: string; days: Day[] }) {
  const t = useT("host");
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ files: number; totalFiles: number; bytes: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function run(key: string, label: string, dayId: string | null, perDayFolders: boolean) {
    const filename = `${safeName(title)}${dayId ? ` - ${safeName(label)}` : ""}.zip`;
    setMessage(null);
    let target: WritableStream<Uint8Array> | null = null;
    try {
      target = await openSaveTarget(filename);
    } catch {
      return; // user cancelled the save dialog
    }
    setRunning(key);
    setProgress({ files: 0, totalFiles: 0, bytes: 0 });
    abort.current = new AbortController();
    try {
      let entries: ZipEntry[] = [];
      if (perDayFolders && days.length > 1) {
        for (const d of days) entries = entries.concat(entriesFor(await fetchAll(occasionId, d.id), d.name));
        const all = await fetchAll(occasionId, null);
        const known = new Set(entries.map((e) => e.url.split("?")[0]));
        entries = entries.concat(entriesFor(all.filter((i) => i.originalUrl && !known.has(i.originalUrl.split("?")[0])), t("download.otherFolder")));
      } else {
        entries = entriesFor(await fetchAll(occasionId, dayId), null);
      }
      if (!entries.length) {
        setMessage({ tone: "error", text: t("download.nothing") });
        await target?.abort().catch(() => {});
        return;
      }
      setProgress({ files: 0, totalFiles: entries.length, bytes: 0 });
      await saveZip(entries, filename, setProgress, { signal: abort.current.signal, target });
      setMessage({ tone: "success", text: t("download.saved") });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessage({ tone: "error", text: t("download.failed") });
    } finally {
      setRunning(null);
      abort.current = null;
    }
  }

  const pct = progress && progress.totalFiles ? Math.round((progress.files / progress.totalFiles) * 100) : 0;
  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        <li className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-ink p-5 text-white">
          <span className="flex flex-col">
            <span className="text-lg font-black">{t("download.everything")}</span>
            <span className="text-sm text-muted-dark">{days.length > 1 ? t("download.everythingHintDays") : t("download.everythingHint")}</span>
          </span>
          <Button variant="light" disabled={!!running} onClick={() => run("all", "", null, true)}><Download size={18} aria-hidden />{t("download.zip")}</Button>
        </li>
        {days.length > 1 ? days.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-tint p-5">
            <span className="text-lg font-black">{d.name}</span>
            <Button variant="secondary" disabled={!!running} onClick={() => run(d.id, d.name, d.id, false)}><Download size={18} aria-hidden />{t("download.zip")}</Button>
          </li>
        )) : null}
      </ul>
      {running && progress ? (
        <div className="flex flex-col gap-3 rounded-[24px] border-2 border-royal p-5" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold">{progress.totalFiles ? t("download.progress", { done: progress.files, total: progress.totalFiles }) : t("download.preparing")}</span>
            <Button variant="secondary" onClick={() => abort.current?.abort()}><X size={16} aria-hidden />{t("common.cancel")}</Button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-tint" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-royal transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm text-muted">{t("download.keepOpen")}</span>
        </div>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <p className="m-0 text-sm text-muted">{t("download.browserNote")}</p>
    </div>
  );
}
