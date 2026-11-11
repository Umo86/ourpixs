"use client";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Lightbox } from "@/components/app/Lightbox";
import { ShareButtons } from "@/components/app/ShareButtons";
import { useT } from "@/i18n/client";
import { formatDuration } from "@/lib/client/format";
import type { MediaItem } from "@/lib/api-types";

export function ShareGallery({ items, shareUrl, shareText, title, downloadsOpen }: { items: MediaItem[]; shareUrl: string; shareText: string; title: string; downloadsOpen: boolean }) {
  const t = useT("guest");
  const [open, setOpen] = useState<number | null>(null);
  const [note, setNote] = useState(false);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(false), 4000);
    return () => clearTimeout(id);
  }, [note]);
  return (
    <>
      <ShareButtons url={shareUrl} text={shareText} title={title} tone="dark" labels={{ whatsapp: t("share.whatsapp"), share: t("share.native"), copy: t("share.copy"), copied: t("share.copied") }} />
      {!items.length ? <p className="m-0 rounded-2xl bg-surface p-6 text-muted-dark">{t("share.empty")}</p> : null}
      <ul className="m-0 grid list-none grid-cols-3 gap-1.5 p-0 sm:grid-cols-4 lg:grid-cols-5">
        {items.map((m, i) => (
          <li key={m.id} className="relative aspect-square overflow-hidden rounded-xl bg-surface-2 [content-visibility:auto] [contain-intrinsic-size:160px]">
            <button type="button" onClick={() => setOpen(i)} aria-label={m.guestName ? t("feed.by", { name: m.guestName }) : t("feed.open")} className="block h-full w-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.thumbUrl ? <img src={m.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              {m.kind === "video" ? <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold"><Play size={10} fill="currentColor" aria-hidden />{formatDuration(m.durationS)}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      {open !== null ? (
        <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} downloadUrl={(m) => m.displayUrl} onDownloadLocked={downloadsOpen ? undefined : () => setNote(true)}
          labels={{ close: t("common.close"), prev: t("common.previous"), next: t("common.next"), download: t("feed.download"), by: (n) => t("feed.by", { name: n }), videoLocked: t("feed.videoLocked") }} />
      ) : null}
      {note ? <div role="status" className="fixed bottom-6 left-1/2 z-[60] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-white px-5 py-3 text-center text-sm font-bold text-ink shadow-xl">{t("feed.downloadsLocked")}</div> : null}
    </>
  );
}
