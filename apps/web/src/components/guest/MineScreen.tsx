"use client";
import { useEffect, useState } from "react";
import { Download, Play, Trash2 } from "lucide-react";
import { Spinner } from "@/components/app/Spinner";
import { useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";
import { formatDuration } from "@/lib/client/format";
import type { MediaItem } from "@/lib/api-types";
import { useGuest } from "./GuestContext";
import { ScreenHeader } from "./ScreenHeader";

export function MineScreen() {
  const t = useT("guest");
  const { occasion: o, path, api: url, uploader } = useGuest();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [note, setNote] = useState(false);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(false), 4000);
    return () => clearTimeout(id);
  }, [note]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => api<{ items: MediaItem[] }>(url("/mine")).then((r) => setItems(r.items)).catch((e) => setError(errorMessage(t, e)));
    void load();
    return uploader.onDone(() => setTimeout(load, 800));
  }, [url, t, uploader]);

  async function remove(m: MediaItem) {
    if (!window.confirm(t("mine.confirm"))) return;
    const prev = items;
    setItems((x) => x?.filter((i) => i.id !== m.id) ?? null);
    try {
      await api(`${url("/mine")}?mediaId=${m.id}`, { method: "DELETE" });
    } catch (e) {
      setItems(prev);
      setError(errorMessage(t, e));
    }
  }

  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5">
      <ScreenHeader title={t("mine.title")} accent={t("mine.titleAccent")} sub={items ? t("mine.count", { n: items.length }) : undefined} close={path} closeLabel={t("common.close")} />
      {error ? <p role="alert" className="m-0 rounded-2xl bg-surface p-4">{error}</p> : null}
      {!items && !error ? <Spinner label={t("common.loading")} /> : null}
      {items && !items.length ? <p className="m-0 rounded-2xl bg-surface p-5 text-muted-dark">{t("mine.empty")}</p> : null}
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        {items?.map((m) => (
          <li key={m.id} className="relative aspect-square overflow-hidden rounded-2xl bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {m.thumbUrl ? <img src={m.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
            {m.kind === "video" ? <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold"><Play size={10} fill="currentColor" aria-hidden />{formatDuration(m.durationS)}</span> : null}
            {m.approved === false ? <span className="absolute left-2 top-2 rounded-full bg-royal px-2 py-0.5 text-[11px] font-bold">{t("mine.pending")}</span> : null}
            <span className="absolute inset-x-2 bottom-2 flex justify-end gap-2">
              {!o.downloadsOpen ? <button type="button" onClick={() => setNote(true)} aria-label={t("feed.download")} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white"><Download size={18} aria-hidden /></button> : null}
              {m.originalUrl ? <a href={m.originalUrl} download target="_blank" rel="noopener" aria-label={t("feed.download")} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white"><Download size={18} aria-hidden /></a> : null}
              <button type="button" onClick={() => remove(m)} aria-label={t("mine.delete")} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white"><Trash2 size={18} aria-hidden /></button>
            </span>
          </li>
        ))}
      </ul>
      {note ? <div role="status" className="fixed bottom-28 left-1/2 z-[60] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-white px-5 py-3 text-center text-sm font-bold text-ink shadow-xl">{t("feed.downloadsLocked")}</div> : null}
    </main>
  );
}
