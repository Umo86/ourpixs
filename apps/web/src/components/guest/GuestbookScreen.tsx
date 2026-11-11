"use client";
import { useEffect, useRef, useState } from "react";
import { Square, Mic, Video, X } from "lucide-react";
import { useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";
import { formatDuration, initial } from "@/lib/client/format";
import type { Message } from "@/lib/api-types";
import { useGuest } from "./GuestContext";
import { ScreenHeader } from "./ScreenHeader";

type Mode = "voice" | "video" | "text";
const MAX_SECONDS = { voice: 60, video: 30 } as const;

function pickMime(kind: "voice" | "video") {
  const options = kind === "voice" ? ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"] : ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
}

export function GuestbookScreen() {
  const t = useT("guest");
  const { occasion: o, guest, api: url } = useGuest();
  const recordable = o.voiceGuestbook && typeof window !== "undefined" && typeof MediaRecorder !== "undefined";
  const [mode, setMode] = useState<Mode>(o.voiceGuestbook ? "voice" : "text");
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string; seconds: number; mime: string } | null>(null);
  const [levels, setLevels] = useState<number[]>(Array(40).fill(4));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Message[]>([]);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef<number>(0);

  useEffect(() => () => { stopAll(); }, []);
  function stopAll() {
    if (timer.current) clearInterval(timer.current);
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  }

  async function startRec() {
    if (mode === "text") return;
    setError(null);
    discard();
    try {
      const s = await navigator.mediaDevices.getUserMedia(mode === "voice" ? { audio: true } : { audio: true, video: { facingMode: "user", width: { ideal: 1280 } } });
      stream.current = s;
      if (mode === "video" && preview.current) { preview.current.srcObject = s; preview.current.muted = true; await preview.current.play().catch(() => {}); }
      const mime = pickMime(mode);
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const started = Date.now();
      r.onstop = () => {
        const type = (r.mimeType || mime || (mode === "voice" ? "audio/webm" : "video/webm")).split(";")[0]!;
        const blob = new Blob(chunks, { type });
        setClip({ blob, url: URL.createObjectURL(blob), seconds: Math.round((Date.now() - started) / 1000), mime: type });
        stopAll();
        setRecording(false);
      };
      r.start(250);
      rec.current = r;
      setRecording(true);
      setElapsed(0);
      timer.current = setInterval(() => setElapsed((n) => {
        if (n + 1 >= MAX_SECONDS[mode] && rec.current?.state === "recording") rec.current.stop();
        return n + 1;
      }), 1000);
      // Live waveform from an AnalyserNode.
      const ac = new AudioContext();
      const an = ac.createAnalyser();
      an.fftSize = 128;
      ac.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(buf);
        setLevels((prev) => [...prev.slice(1), 4 + Math.round((buf.reduce((a, b) => a + b, 0) / buf.length / 255) * 52)]);
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError(t("book.micDenied"));
      stopAll();
    }
  }
  function stopRec() { if (rec.current?.state === "recording") rec.current.stop(); }
  function discard() { if (clip) URL.revokeObjectURL(clip.url); setClip(null); setElapsed(0); }

  async function send() {
    setSending(true);
    setError(null);
    try {
      let message: Message;
      if (mode === "text") {
        ({ message } = await api<{ message: Message }>(url("/messages"), { body: { kind: "text", body: text.trim() } }));
        setText("");
      } else {
        if (!clip) return;
        const up = await api<{ mediaKey: string; upload: { url: string; headers: Record<string, string> } }>(url("/messages/upload-url"), { body: { mime: clip.mime, bytes: clip.blob.size } });
        if (!up.upload.url.startsWith("demo:")) {
          const put = await fetch(up.upload.url, { method: "PUT", headers: up.upload.headers, body: clip.blob });
          if (!put.ok) throw new Error("put");
        }
        ({ message } = await api<{ message: Message }>(url("/messages"), { body: { kind: mode, mediaKey: up.mediaKey, durationS: clip.seconds } }));
        discard();
      }
      setSent((s) => [message, ...s]);
    } catch (e) {
      setError(e instanceof Error && e.message === "put" ? t("book.uploadFailed") : errorMessage(t, e));
    } finally {
      setSending(false);
    }
  }

  const modes: Mode[] = recordable ? ["voice", "video", "text"] : ["text"];
  const max = mode === "text" ? 0 : MAX_SECONDS[mode];
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5">
      <ScreenHeader title={t("book.title")} accent={t("book.titleAccent")} sub={t("book.sub", { hosts: o.honorees.join(" & ") || o.title })} />
      {modes.length > 1 ? (
        <div role="group" aria-label={t("book.type")} className="grid grid-cols-3 rounded-full bg-surface p-1">
          {modes.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} disabled={recording} onClick={() => { discard(); setMode(m); }}
              className={`min-h-11 rounded-full text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${mode === m ? "bg-white font-extrabold text-ink" : "font-bold text-muted-dark"}`}>{t(`book.mode.${m}`)}</button>
          ))}
        </div>
      ) : null}

      {mode === "text" ? (
        <form className="flex flex-col gap-3 rounded-[28px] bg-royal p-5" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label htmlFor="note" className="text-[15px] font-extrabold">{t("book.writeLabel")}</label>
          <textarea id="note" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={5} placeholder={t("book.placeholder")}
            className="w-full resize-y rounded-2xl border-0 bg-white/95 p-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-white" />
          <button type="submit" disabled={sending || !text.trim()} className="min-h-12 self-end rounded-full bg-white px-6 text-sm font-extrabold text-royal disabled:opacity-60">{sending ? t("book.sending") : t("book.send")}</button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-[28px] bg-royal px-5 py-6">
          {mode === "video" ? (
            <div className="aspect-[3/4] w-full max-w-64 overflow-hidden rounded-2xl bg-black">
              {clip ? <video src={clip.url} controls playsInline className="h-full w-full object-cover" /> : <video ref={preview} playsInline muted className="h-full w-full -scale-x-100 object-cover" />}
            </div>
          ) : null}
          <span className="text-[44px] font-black leading-none tracking-[-0.05em]" aria-live="polite">
            {formatDuration(clip ? clip.seconds : elapsed)} <span className="text-base font-semibold tracking-normal text-[#E3E8FF]">/ {formatDuration(max)}</span>
          </span>
          {mode === "voice" ? (
            clip ? <audio src={clip.url} controls className="w-full" /> : (
              <div role="img" aria-label={t("book.waveform")} className="flex h-14 w-full items-center gap-[3px]">
                {levels.map((h, i) => <span key={i} className="flex-1 rounded-full" style={{ height: h, background: recording ? "#FFFFFF" : "#5C78F0" }} />)}
              </div>
            )
          ) : null}
          <div className="flex items-center gap-5">
            <button type="button" aria-label={t("book.discard")} onClick={discard} disabled={!clip || recording} className="flex h-12 w-12 items-center justify-center rounded-full bg-royal-dark disabled:opacity-40"><X size={20} aria-hidden /></button>
            <button type="button" aria-pressed={recording} aria-label={recording ? t("book.stop") : t("book.record")} onClick={recording ? stopRec : startRec}
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[5px] border-white bg-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky">
              {recording ? <Square size={24} fill="white" aria-hidden /> : mode === "voice" ? <Mic size={28} aria-hidden className="text-sky" /> : <Video size={28} aria-hidden className="text-sky" />}
            </button>
            <button type="button" onClick={send} disabled={!clip || sending || recording} className="min-h-12 rounded-full bg-white px-5 text-sm font-extrabold text-royal disabled:opacity-50">{sending ? t("book.sending") : t("book.send")}</button>
          </div>
        </div>
      )}
      {!o.voiceGuestbook ? <p className="m-0 text-xs text-[#A8ACB8]">{t("book.textOnly")}</p> : null}
      {error ? <p role="alert" className="m-0 rounded-2xl bg-surface p-4 text-sm">{error}</p> : null}

      {sent.length ? (
        <section className="flex flex-col gap-2.5">
          <span className="text-[13px] font-bold text-muted-dark">{t("book.sent", { n: sent.length })}</span>
          {sent.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5">
              <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-royal font-extrabold">{initial(guest?.displayName)}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-extrabold">{guest?.displayName}</span>
                <span className="truncate text-[13px] text-muted-dark">{m.kind === "text" ? m.body : `${t(`book.mode.${m.kind}`)} · ${formatDuration(m.durationS)}`}</span>
              </span>
              <span className="text-xs text-[#A8ACB8]">{t("book.justNow")}</span>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
