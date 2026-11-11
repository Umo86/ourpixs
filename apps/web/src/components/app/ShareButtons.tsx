"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

type Props = {
  url: string;
  /** Ready-made message; `{url}` is replaced (or the url appended). */
  text: string;
  title?: string;
  labels: { whatsapp: string; share: string; copy: string; copied: string };
  tone?: "light" | "dark";
  className?: string;
};

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z" />
    </svg>
  );
}

/** WhatsApp (wa.me), native Web Share where available, and copy-link. */
export function ShareButtons({ url, text, title, labels, tone = "light", className = "" }: Props) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = text.includes("{url}") ? text.replace("{url}", url) : `${text} ${url}`;
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  const btn = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${
    tone === "dark" ? "bg-surface-2 text-white hover:bg-[#2E323D]" : "border-[1.5px] border-ink text-ink hover:bg-ink hover:text-white"}`;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener" className={`${btn} !border-[#1FAF5A] bg-[#25D366] !text-[#0A0A0A] hover:!bg-[#1FAF5A]`}>
        <WhatsAppIcon />{labels.whatsapp}
      </a>
      {canShare ? (
        <button type="button" className={btn} onClick={() => navigator.share({ title, text: message, url }).catch(() => {})}>
          <Share2 size={18} aria-hidden />{labels.share}
        </button>
      ) : null}
      <button type="button" className={btn} onClick={async () => { await navigator.clipboard?.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
        {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}{copied ? labels.copied : labels.copy}
      </button>
    </div>
  );
}
