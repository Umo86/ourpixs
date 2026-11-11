"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Spinner } from "@/components/app/Spinner";
import { useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";
import type { GuestMission } from "@/lib/api-types";
import { useGuest } from "./GuestContext";
import { ScreenHeader } from "./ScreenHeader";

type Payload = { missions: GuestMission[]; leaderboard: { guestName: string | null; done: number }[]; me: { rank: number | null; done: number } | null };

export function MissionsScreen() {
  const t = useT("guest");
  const { occasion: o, path, api: url } = useGuest();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api<Payload>(url("/missions")).then(setData).catch((e) => setError(errorMessage(t, e))); }, [url, t]);

  const total = data?.missions.length ?? 0;
  const done = data?.missions.filter((m) => m.done).length ?? 0;
  const top = data?.leaderboard[0];
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5">
      <ScreenHeader title={t("missions.title")} accent={t("missions.titleAccent")} sub={t("missions.sub", { hosts: o.honorees.join(" & ") || o.title })} />
      {!o.missionsEnabled ? <p className="m-0 rounded-2xl bg-surface p-5 text-muted-dark">{t("missions.off")}</p> : null}
      {error ? <p role="alert" className="m-0 rounded-2xl bg-surface p-4">{error}</p> : null}
      {!data && !error && o.missionsEnabled ? <Spinner label={t("common.loading")} /> : null}
      {data && total === 0 && o.missionsEnabled ? <p className="m-0 rounded-2xl bg-surface p-5 text-muted-dark">{t("missions.none")}</p> : null}
      {data && total > 0 ? (
        <>
          <div className="flex items-center justify-between gap-3.5 rounded-[24px] bg-royal p-[18px]">
            <div className="flex flex-1 flex-col gap-2">
              <span className="text-[15px] font-extrabold">{t("missions.progress", { done, total })}</span>
              <span className="h-2 overflow-hidden rounded-full bg-royal-dark" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={t("missions.progress", { done, total })}>
                <span className="block h-full rounded-full bg-white" style={{ width: `${Math.round((done / total) * 100)}%` }} />
              </span>
            </div>
            {data.me?.rank ? <span className="rotate-[4deg] rounded-full bg-white px-3.5 py-2 text-[13px] font-extrabold text-royal">{t("missions.rank", { n: data.me.rank })}</span> : null}
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.missions.map((m) => (
              <li key={m.id} className={`flex items-center gap-3 rounded-[20px] py-3 pl-3.5 pr-3 ${m.done ? "bg-surface text-white" : "bg-white text-ink"}`}>
                <span aria-hidden className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-extrabold ${m.done ? "bg-royal text-white" : "border-2 border-ink"}`}>{m.done ? <Check size={16} /> : null}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-extrabold tracking-tight">{m.title}</span>
                  <span className="text-[12.5px] opacity-75">{t("missions.count", { n: m.doneCount })}</span>
                </span>
                {m.done ? (
                  <span className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-[#3A3F52] px-4 text-[13px] font-extrabold text-muted-dark">{t("missions.done")}</span>
                ) : (
                  <Link href={`${path}/upload?mission=${m.id}`} className="inline-flex min-h-11 items-center rounded-full bg-royal px-4 text-[13px] font-extrabold text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">{t("missions.snap")}</Link>
                )}
              </li>
            ))}
          </ul>
          {top ? <p className="m-0 text-[13px] text-muted-dark">{t("missions.top")} <strong className="text-white">{t("missions.topLine", { name: top.guestName || "", done: top.done, total })}</strong></p> : null}
          {data.leaderboard.length > 1 ? (
            <section aria-labelledby="lb" className="rounded-[24px] bg-surface p-5">
              <h2 id="lb" className="m-0 mb-3 text-lg font-black">{t("missions.leaderboard")}</h2>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {data.leaderboard.map((l, i) => (
                  <li key={i} className="flex justify-between text-[15px]"><span><span className="mr-3 font-black text-sky-soft">{i + 1}</span>{l.guestName}</span><span className="font-bold">{l.done}/{total}</span></li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
