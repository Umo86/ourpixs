"use client";
import { useEffect, useState } from "react";
import { Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui";
import { Notice } from "@/components/app/Notice";
import { Spinner } from "@/components/app/Spinner";
import { useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";
import { getMessageArray } from "./messages-helper";

type Mission = { id: string; title: string; sortOrder: number; doneCount: number };
type Payload = { missions: Mission[]; leaderboard: { guestId: string; guestName: string | null; done: number }[] };

export function MissionsClient({ occasionId }: { occasionId: string }) {
  const t = useT("host");
  const [data, setData] = useState<Payload | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/v1/occasions/${occasionId}/missions`;

  useEffect(() => {
    api<Payload>(base).then(setData).catch((e) => setError(errorMessage(t, e)));
  }, [base, t]);

  async function add(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setData(await api<Payload>(base, { body: { title: text.trim() } }));
      setTitle("");
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("missions.confirmDelete"))) return;
    try {
      setData(await api<Payload>(`${base}?missionId=${id}`, { method: "DELETE" }));
    } catch (e) {
      setError(errorMessage(t, e));
    }
  }

  if (!data && !error) return <Spinner label={t("common.loading")} />;
  const ideas = getMessageArray(t, "missions.ideas").filter((i) => !data?.missions.some((m) => m.title === i));

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={(e) => { e.preventDefault(); void add(title); }} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="mission" className="sr-only">{t("missions.new")}</label>
        <input id="mission" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={t("missions.placeholder")}
          className="min-h-12 flex-1 rounded-full border-[1.5px] border-[#D5D8E2] px-5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky" />
        <Button type="submit" disabled={busy || title.trim().length < 2}>{t("missions.add")}</Button>
      </form>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {ideas.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-muted">{t("missions.ideasTitle")}</span>
          <div className="flex flex-wrap gap-2">
            {ideas.slice(0, 6).map((i) => (
              <button key={i} type="button" onClick={() => add(i)} disabled={busy} className="min-h-10 rounded-full bg-tint px-4 text-[13px] font-bold hover:bg-[#E4E8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">+ {i}</button>
            ))}
          </div>
        </div>
      ) : null}
      {data?.missions.length ? (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {data.missions.map((m, i) => (
            <li key={m.id} className="flex items-center gap-4 rounded-[20px] bg-tint px-5 py-3">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-royal text-sm font-black text-white">{i + 1}</span>
              <span className="flex flex-1 flex-col">
                <span className="font-extrabold">{m.title}</span>
                <span className="text-sm text-muted">{t("missions.doneBy", { n: m.doneCount })}</span>
              </span>
              <button type="button" onClick={() => remove(m.id)} aria-label={t("missions.delete", { title: m.title })} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><Trash2 size={18} aria-hidden /></button>
            </li>
          ))}
        </ol>
      ) : data ? <p className="m-0 text-muted">{t("missions.empty")}</p> : null}
      {data?.leaderboard.length ? (
        <section className="flex flex-col gap-3 rounded-[28px] bg-ink p-6 text-white">
          <h3 className="m-0 flex items-center gap-2 text-xl font-black"><Trophy size={20} aria-hidden className="text-sky-soft" />{t("missions.leaderboard")}</h3>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {data.leaderboard.map((l, i) => (
              <li key={l.guestId} className="flex items-center justify-between gap-3 text-[15px]">
                <span><span className="mr-3 font-black text-sky-soft">{i + 1}</span>{l.guestName}</span>
                <span className="font-bold">{t("missions.score", { n: l.done, total: data.missions.length })}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
