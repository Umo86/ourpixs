"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, RefreshCw, X } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import { formatDate } from "@/lib/client/format";
import { api } from "@/lib/client/api";
import type { GuestMission } from "@/lib/api-types";
import { useGuest } from "./GuestContext";
import { ScreenHeader } from "./ScreenHeader";

export function UploadScreen() {
  const t = useT("guest");
  const { locale } = useLocale();
  const { occasion: o, path, uploader, lockedDayId, api: url } = useGuest();
  const sp = useSearchParams();
  const missionId = sp.get("mission");
  const queue = useSyncExternalStore(uploader.subscribe, uploader.getSnapshot, () => []);
  const today = new Date().toISOString().slice(0, 10);
  const openDays = o.days.filter((d) => d.uploadOpen !== false);
  const [dayId, setDayId] = useState<string | null>(null);
  const [moment, setMoment] = useState<string | null>(null);
  const [mission, setMission] = useState<GuestMission | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const batch = useRef(0);

  useEffect(() => {
    setDayId(lockedDayId ?? (openDays.find((d) => d.date === today) ?? openDays[0] ?? o.days[0])?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedDayId]);

  useEffect(() => {
    if (!missionId) return;
    api<{ missions: GuestMission[] }>(url("/missions")).then((r) => setMission(r.missions.find((m) => m.id === missionId) ?? null)).catch(() => {});
  }, [missionId, url]);

  // "Harika! 3 fotoğraf yüklendi" once a batch finishes.
  useEffect(() => uploader.onDone(() => {
    batch.current++;
    const busy = uploader.getSnapshot().some((q) => q.status !== "done" && q.status !== "error");
    if (!busy) {
      setToast(t("upload.doneToast", { n: batch.current }));
      batch.current = 0;
    }
  }), [uploader, t]);
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(null), 4000); return () => clearTimeout(id); } }, [toast]);

  const stats = useMemo(() => ({
    total: queue.length,
    done: queue.filter((q) => q.status === "done").length,
    failed: queue.filter((q) => q.status === "error").length,
  }), [queue]);
  const day = o.days.find((d) => d.id === dayId);
  const closed = !o.uploadOpen || (day && day.uploadOpen === false);

  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5">
      <ScreenHeader title={t("upload.title")} accent={t("upload.titleAccent")} close={path} closeLabel={t("common.close")} />

      {lockedDayId && day ? (
        <span className="self-start rounded-full bg-white px-4 py-2 text-sm font-extrabold text-ink">{day.name}{day.date ? ` · ${formatDate(day.date, locale, { day: "numeric", month: "short" })}` : ""}</span>
      ) : o.days.length > 1 ? (
        <div role="group" aria-label={t("upload.day")} className="grid rounded-full bg-surface p-1" style={{ gridTemplateColumns: `repeat(${o.days.length}, minmax(0, 1fr))` }}>
          {o.days.map((d) => (
            <button key={d.id} type="button" aria-pressed={dayId === d.id} onClick={() => setDayId(d.id)} disabled={d.uploadOpen === false}
              className={`min-h-11 truncate rounded-full px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky disabled:opacity-40 ${dayId === d.id ? "bg-white font-extrabold text-ink" : "font-bold text-muted-dark"}`}>
              {d.name}{d.date ? ` · ${formatDate(d.date, locale, { day: "numeric", month: "short" })}` : ""}
            </button>
          ))}
        </div>
      ) : null}

      {mission ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
          <span className="text-sm"><span className="text-muted-dark">{t("upload.forMission")}</span> <strong>{mission.title}</strong></span>
        </div>
      ) : null}

      {closed ? (
        <div className="rounded-[28px] bg-surface p-6 text-center">
          <p className="m-0 text-xl font-black">{t("upload.closedTitle")}</p>
          <p className="m-0 mt-2 text-muted-dark">{t("upload.closedBody")}</p>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()}
          className="flex flex-col items-center gap-2 rounded-[28px] bg-royal px-5 py-7 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
          <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-royal"><Plus size={32} /></span>
          <span className="text-[22px] font-extrabold tracking-tight">{o.plan === "free" ? t("upload.choosePhotos") : t("upload.choose")}</span>
          <span className="text-[13px] text-[#E3E8FF]">{t("upload.chooseHint")}</span>
        </button>
      )}
      <input ref={input} type="file" multiple hidden accept={o.plan === "free" ? "image/*" : "image/*,video/*"} onChange={(e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) uploader.add(files, { dayId, momentTag: moment, missionId });
        e.target.value = "";
      }} />

      {o.moments.length ? (
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-bold text-muted-dark">{t("upload.moment")}</span>
          <div className="flex flex-wrap gap-2">
            {o.moments.map((m) => (
              <button key={m} type="button" aria-pressed={moment === m} onClick={() => setMoment(moment === m ? null : m)}
                className={`min-h-11 rounded-full border-[1.5px] px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${moment === m ? "border-white bg-white text-ink" : "border-[#3A3F52] text-white"}`}>{m}</button>
            ))}
          </div>
        </div>
      ) : null}

      {queue.length ? (
        <section aria-live="polite" className="flex flex-col gap-3 rounded-[24px] bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-extrabold">{stats.done === stats.total ? t("upload.allDone") : t("upload.uploading")}</span>
            <span className="text-[13px] font-bold text-sky-soft">{t("upload.progress", { done: stats.done, total: stats.total })}</span>
          </div>
          <ul className="m-0 flex max-h-[40vh] list-none flex-col gap-3 overflow-y-auto p-0">
            {queue.slice().reverse().map((q) => (
              <li key={q.id} className="flex items-center gap-3">
                <span className="h-11 w-11 flex-none overflow-hidden rounded-xl bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {q.preview ? <img src={q.preview} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex justify-between gap-2 text-[13px]">
                    <span className="truncate font-semibold">{q.name}</span>
                    <span className={q.status === "error" ? "text-[#FF9A9A]" : "text-muted-dark"}>
                      {q.status === "done" ? t("upload.statusDone") : q.status === "error" ? t(`errors.${q.errorCode}`) !== `errors.${q.errorCode}` ? t(`errors.${q.errorCode}`) : t("upload.statusFailed")
                        : q.status === "queued" ? (q.attempts ? t("upload.statusRetrying") : t("upload.statusWaiting")) : q.status === "processing" ? t("upload.statusPreparing") : `${Math.round(q.progress * 100)}%`}
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-[#2A2E3B]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(q.progress * 100)} aria-label={q.name}>
                    <span className={`block h-full rounded-full ${q.status === "error" ? "bg-[#FF6B6B]" : "bg-sky"}`} style={{ width: `${Math.round((q.status === "done" ? 1 : q.progress) * 100)}%` }} />
                  </span>
                </span>
                {q.status === "error" ? (
                  <button type="button" onClick={() => uploader.retry(q.id)} aria-label={t("common.retry")} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-2"><RefreshCw size={16} aria-hidden /></button>
                ) : q.status === "done" || q.status === "queued" ? (
                  <button type="button" onClick={() => uploader.remove(q.id)} aria-label={t("upload.removeFromList")} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-dark hover:bg-surface-2"><X size={16} aria-hidden /></button>
                ) : null}
              </li>
            ))}
          </ul>
          <span className="text-xs text-[#A8ACB8]">{t("upload.resumeNote")}</span>
          {stats.done && stats.done === stats.total ? <button type="button" onClick={() => uploader.clearDone()} className="min-h-11 self-start text-sm font-bold text-sky-soft">{t("upload.clear")}</button> : null}
        </section>
      ) : null}

      {toast ? <div role="status" className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-5 py-3 text-sm font-extrabold text-ink shadow-xl">{toast}</div> : null}
    </main>
  );
}
