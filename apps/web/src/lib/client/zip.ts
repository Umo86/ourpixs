"use client";
import { downloadZip } from "client-zip";

export type ZipEntry = { name: string; url: string; lastModified?: Date; size?: number };
export type ZipProgress = { files: number; totalFiles: number; bytes: number };

type SavePicker = (opts: { suggestedName: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;

export function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "file";
}

/**
 * Streams a ZIP built in the browser (client-zip). Files are fetched one at a time from their signed URLs,
 * so memory stays flat when the File System Access API is available (Chrome/Edge); elsewhere the ZIP is
 * assembled as a Blob and downloaded.
 */
/**
 * Call first, straight from the click handler (the picker needs a fresh user gesture).
 * Returns a writable on Chrome/Edge, null elsewhere. Throws AbortError if the user cancels.
 */
export async function openSaveTarget(filename: string): Promise<WritableStream<Uint8Array> | null> {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (!picker) return null;
  try {
    const handle = await picker({ suggestedName: filename, types: [{ description: "ZIP", accept: { "application/zip": [".zip"] } }] });
    return await handle.createWritable();
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return null;
  }
}

export async function saveZip(entries: ZipEntry[], filename: string, onProgress: (p: ZipProgress) => void, opts: { signal?: AbortSignal; target?: WritableStream<Uint8Array> | null } = {}) {
  const signal = opts.signal;
  let files = 0;
  let bytes = 0;
  async function* inputs() {
    for (const e of entries) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      let res: Response | null = null;
      for (let i = 0; i < 3 && !res; i++) {
        try {
          const r = await fetch(e.url, { signal });
          if (r.ok) res = r;
        } catch (err) {
          if ((err as Error).name === "AbortError") throw err;
        }
      }
      files++;
      if (!res || !res.body) { onProgress({ files, totalFiles: entries.length, bytes }); continue; }
      const reader = res.body.getReader();
      const counted = new ReadableStream<Uint8Array>({
        async pull(ctrl) {
          const { done, value } = await reader.read();
          if (done) { ctrl.close(); onProgress({ files, totalFiles: entries.length, bytes }); return; }
          bytes += value.byteLength;
          ctrl.enqueue(value);
        },
        cancel() { reader.cancel().catch(() => {}); },
      });
      yield { name: e.name, input: counted, lastModified: e.lastModified };
    }
  }
  const zip = downloadZip(inputs());
  if (opts.target && zip.body) {
    await zip.body.pipeTo(opts.target, { signal });
    return;
  }
  const blob = await zip.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif", "image/webp": "webp",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};
