"use client";
import { useState } from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";
import { formatDateTime, formatDuration, initial } from "@/lib/client/format";
import type { Message } from "@/lib/api-types";
import { Notice } from "@/components/app/Notice";

export function GuestbookClient({ occasionId, initial: init }: { occasionId: string; initial: Message[] }) {
  const t = useT("host");
  const { locale } = useLocale();
  const [messages, setMessages] = useState(init);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    if (!window.confirm(t("guestbook.confirmDelete"))) return;
    try {
      const r = await api<{ messages: Message[] }>(`/api/v1/occasions/${occasionId}/messages?messageId=${id}`, { method: "DELETE" });
      setMessages(r.messages);
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }

  if (!messages.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[28px] bg-tint px-6 py-14 text-center">
        <BookOpen size={34} aria-hidden className="text-royal" />
        <p className="m-0 text-xl font-extrabold">{t("guestbook.empty")}</p>
        <p className="m-0 max-w-md text-muted">{t("guestbook.emptyHint")}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <p className="m-0 text-sm font-bold text-muted">{t("guestbook.count", { n: messages.length })}</p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {messages.map((m) => (
          <li key={m.id} className="flex flex-col gap-3 rounded-[24px] bg-tint p-5">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-royal font-black text-white">{initial(m.guestName)}</span>
              <span className="flex flex-1 flex-col">
                <span className="font-extrabold">{m.guestName || t("guestbook.anonymous")}</span>
                <span className="text-sm text-muted">
                  {t(`guestbook.kind.${m.kind}`)}{m.durationS ? ` · ${formatDuration(m.durationS)}` : ""} · {formatDateTime(m.createdAt, locale)}
                </span>
              </span>
              <button type="button" onClick={() => remove(m.id)} aria-label={t("common.delete")} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><Trash2 size={18} aria-hidden /></button>
            </div>
            {m.body ? <p className="m-0 whitespace-pre-wrap text-[17px] leading-relaxed">{m.body}</p> : null}
            {m.kind === "voice" && m.mediaUrl ? <audio controls preload="none" src={m.mediaUrl} className="w-full" /> : null}
            {m.kind === "video" && m.mediaUrl ? <video controls preload="metadata" playsInline src={m.mediaUrl} className="max-h-[480px] w-full rounded-2xl bg-black" /> : null}
            {m.mediaUrl ? <a href={m.mediaUrl} download className="self-start text-sm font-bold text-royal">{t("common.download")}</a> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
