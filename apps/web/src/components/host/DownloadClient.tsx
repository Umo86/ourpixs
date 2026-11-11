"use client";
import { useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Notice } from "@/components/app/Notice";
import { useT } from "@/i18n/client";
import { api } from "@/lib/client/api";
import { openSaveTarget, safeName, saveZip, type ZipEntry } from "@/lib/client/zip";
import { ApiClientError } from "@/lib/client/api";
import { UpgradeDialog } from "./Billing";

type Day = { id: string; name: string };
type ManifestFile = { id: string; name: string; url: string; createdAt: string };

/** Signed originals from the server (402 plan_required while downloads are locked). */
async function manifest(occasionId: string, dayId: string | null): Promise<ManifestFile[]> {
  const r = await api<{ files: ManifestFile[] }>(`/api/v1/occasions/${occasionId}/download${dayId ? `?dayId=${dayId}` : ""}`);
  return r.files;
}

const toEntries = (files: ManifestFile[], folder: string | null): ZipEntry[] =>
  files.map((f) => ({ name: folder ? `${safeName(folder)}/${f.name}` : f.name, url: f.url, lastModified: new Date(f.createdAt) }));

/** Client-side streaming ZIP per day (or everything), straight from storage to disk. */
export function DownloadClient({ occasionId, title, days, canDownload, isOwner, payments }: { occasionId: string; title: string; days: Day[]; canDownload: boolean; isOwner: boolean; payments: boolean }) {
  const t = useT("host");
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ files: number; totalFiles: number; bytes: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [locked, setLocked] = useState(false);

  async function run(key: string, label: string, dayId: string | null, perDayFolders: boolean) {
    const filename = `${safeName(title)}${dayId ? ` - ${safeName(label)}` : ""}.zip`;
    if (!canDownload) { setLocked(true); return; }
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
        const seen = new Set<string>();
        for (const d of days) {
          const files = await manifest(occasionId, d.id);
          files.forEach((f) => seen.add(f.id));
          entries = entries.concat(toEntries(files, d.name));
        }
        const rest = (await manifest(occasionId, null)).filter((f) => !seen.has(f.id));
        entries = entries.concat(toEntries(rest, t("download.otherFolder")));
      } else {
        entries = toEntries(await manifest(occasionId, dayId), null);
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
      await target?.abort().catch(() => {});
      if (e instanceof ApiClientError && e.code === "plan_required") setLocked(true);
      else if ((e as Error).name !== "AbortError") setMessage({ tone: "error", text: t("download.failed") });
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
      <UpgradeDialog open={locked} onClose={() => setLocked(false)} isOwner={isOwner} payments={payments} />
    </div>
  );
}
