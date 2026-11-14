"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SwitchCamera } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import { formatDateTime } from "@/lib/client/format";
import { useGuest } from "./GuestContext";

/** Draws the frame with a film look + grain, returns a JPEG (no EXIF, so nothing to strip). */
async function develop(video: HTMLVideoElement, mirror: boolean): Promise<Blob | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, 2400 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.filter = "contrast(1.12) saturate(0.82) sepia(0.14) brightness(1.02)";
  if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, c.width, c.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  // Grain
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    d[i] = d[i]! + n; d[i + 1] = d[i + 1]! + n; d[i + 2] = d[i + 2]! + n;
  }
  ctx.putImageData(img, 0, 0);
  // Vignette
  const g = ctx.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
}

export function CameraScreen() {
  const t = useT("guest");
  const { locale } = useLocale();
  const { occasion: o, guest, uploader, lockedDayId, path } = useGuest();
  const total = o.disposableShots ?? 0;
  const queue = useSyncExternalStore(uploader.subscribe, uploader.getSnapshot, () => []);
  const [taken, setTaken] = useState(guest?.shotsTaken ?? 0);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [flash, setFlash] = useState(false);
  const [state, setState] = useState<"starting" | "ready" | "denied" | "unsupported">("starting");
  const [flashFx, setFlashFx] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fallback = useRef<HTMLInputElement>(null);
  const left = Math.max(0, total - taken);

  const stop = () => { stream.current?.getTracks().forEach((tr) => tr.stop()); stream.current = null; };

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setState("unsupported"); return; }
    stop();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      stream.current = s;
      if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
      setState("ready");
    } catch (e) {
      setState((e as Error).name === "NotAllowedError" ? "denied" : "unsupported");
    }
  }, [facing]);

  useEffect(() => { if (total) void start(); return stop; }, [start, total]);

  async function setTorch(on: boolean) {
    const track = stream.current?.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
    if (track && caps?.torch) await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => {});
  }

  async function shoot() {
    if (!left || !video.current) return;
    if (flash) await setTorch(true);
    setFlashFx((n) => n + 1);
    const blob = await develop(video.current, facing === "user");
    if (flash) void setTorch(false);
    if (!blob) return;
    const file = new File([blob], `disposable-${Date.now()}.jpg`, { type: "image/jpeg" });
    uploader.add([file], { fromDisposable: true, dayId: lockedDayId });
    setTaken((n) => n + 1);
    navigator.vibrate?.(30);
  }

  if (!total) {
    return (
      <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5">
        <h1 className="m-0 text-[26px] font-black tracking-[-0.04em]">{t("camera.title")} <span className="font-serif font-normal text-sky-soft">{t("camera.titleAccent")}</span></h1>
        <p className="m-0 rounded-2xl bg-surface p-5 text-muted-dark">{t("camera.off")}</p>
      </main>
    );
  }

  const reveal = o.revealAt ? t("camera.revealAt", { time: formatDateTime(o.revealAt, locale, o.timeZone) }) : t("camera.revealMorning");
  const pending = queue.filter((q) => q.meta.fromDisposable && q.status !== "done").length;
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3">
      <header className="flex items-center justify-between px-5 pt-1">
        <h1 className="m-0 text-[26px] font-black tracking-[-0.04em]">{t("camera.title")} <span className="font-serif font-normal text-sky-soft">{t("camera.titleAccent")}</span></h1>
        <span className="rounded-full bg-white px-3.5 py-2 text-[13px] font-extrabold text-ink" aria-live="polite">{t("camera.left", { n: left })}</span>
      </header>

      <div className="relative mx-3.5 flex min-h-[48dvh] flex-1 flex-col justify-between overflow-hidden rounded-[32px] bg-[#1B2440] p-4">
        <video ref={video} playsInline muted aria-label={t("camera.viewfinder")} className={`film-look absolute inset-0 h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
        <span className="film-grain" aria-hidden />
        <span className="vignette" aria-hidden />
        {flashFx ? <span key={flashFx} aria-hidden className="shutter-flash pointer-events-none absolute inset-0 bg-white opacity-0" /> : null}
        <div className="relative flex items-center justify-between">
          <span className="rounded-full bg-black/60 px-3 py-2 text-xs font-bold">{t("camera.film")}</span>
          <button type="button" aria-pressed={flash} onClick={() => setFlash((f) => !f)}
            className={`min-h-11 rounded-full px-3.5 text-xs font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${flash ? "bg-white text-ink" : "bg-black/60 text-white"}`}>
            {flash ? t("camera.flashOn") : t("camera.flashOff")}
          </button>
        </div>
        {state === "denied" || state === "unsupported" ? (
          <div className="relative flex flex-col items-center gap-3 rounded-2xl bg-black/70 p-5 text-center">
            <p className="m-0 text-[15px]">{state === "denied" ? t("camera.denied") : t("camera.unsupported")}</p>
            <button type="button" onClick={() => fallback.current?.click()} className="min-h-11 rounded-full bg-royal px-5 font-extrabold">{t("camera.useNative")}</button>
          </div>
        ) : <span aria-hidden className="relative h-[200px] w-[200px] self-center rounded-[24px] border-[1.5px] border-white/55" />}
        <span className="relative rotate-[-2deg] self-center rounded-full bg-royal px-4 py-2 text-[13px] font-bold">{reveal}</span>
      </div>
      <input ref={fallback} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
        const f = e.target.files?.[0];
        if (f && left) { uploader.add([f], { fromDisposable: true, dayId: lockedDayId }); setTaken((n) => n + 1); }
        e.target.value = "";
      }} />

      <div className="flex items-center justify-between px-7 pt-2">
        <Link href={`${path}/mine`} aria-label={t("camera.roll")} className="relative flex h-14 w-14 items-end justify-end rounded-2xl border-2 border-white bg-surface-2 no-underline">
          <span className="-m-1.5 rounded-full bg-royal px-1.5 py-0.5 text-[11px] font-extrabold text-white">{taken}</span>
        </Link>
        <button type="button" aria-label={t("camera.shoot")} onClick={shoot} disabled={!left || state !== "ready"}
          className="h-[84px] w-[84px] rounded-full border-[5px] border-white bg-royal transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky disabled:opacity-40" />
        <button type="button" aria-label={t("camera.flip")} onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><SwitchCamera size={24} aria-hidden /></button>
      </div>
      <div aria-label={t("camera.rollLabel", { taken, total })} role="img" className="flex gap-1 px-7">
        {Array.from({ length: Math.min(total, 40) }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < Math.round((taken / total) * Math.min(total, 40)) ? "bg-sky" : "bg-[#2A2E3B]"}`} />
        ))}
      </div>
      {pending ? <p className="m-0 px-7 text-xs text-[#A8ACB8]">{t("camera.saving", { n: pending })}</p> : null}
      {!left ? <p className="m-0 px-7 text-sm font-bold text-sky-soft">{t("camera.out")}</p> : null}
    </main>
  );
}
