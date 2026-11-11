"use client";
import Image from "next/image";
import { useState } from "react";
import { Heart } from "lucide-react";
import { MEDIA } from "./constants";

type Photo = { key: string; alt: string; guest: string; tag: string };
type Props = { event: string; tabs: string[]; photos: Photo[]; likeLabel: string; likedLabel: string; ago: string; by: string };

/** Static, clearly-labelled demo of the guest feed. Hearts toggle locally only. */
export function DemoFeed({ event, tabs, photos, likeLabel, likedLabel, ago, by }: Props) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[36px] border-[6px] border-ink bg-ink text-white shadow-2xl">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <span className="text-lg font-black tracking-[-0.03em]">{event}</span>
      </div>
      <div role="tablist" aria-label={event} className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm font-bold">
        {tabs.map((tab, i) => (
          <span key={tab} role="tab" aria-selected={i === 0} className={`whitespace-nowrap rounded-full px-4 py-2 ${i === 0 ? "bg-royal" : "text-muted-dark"}`}>{tab}</span>
        ))}
      </div>
      <ul className="m-0 flex max-h-[640px] list-none flex-col gap-3 overflow-y-auto p-3 pt-0">
        {photos.map((p, i) => {
          const on = !!liked[p.key];
          return (
            <li key={p.key} className="overflow-hidden rounded-3xl bg-surface">
              <div className="relative aspect-[4/3]">
                <Image src={MEDIA[p.key as keyof typeof MEDIA]} alt={p.alt} fill sizes="400px" className="object-cover" priority={i < 2} />
                <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-bold">{p.tag}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-dark">{by} <strong className="text-white">{p.guest}</strong> · {ago}</span>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={on ? likedLabel : likeLabel}
                  onClick={() => setLiked((s) => ({ ...s, [p.key]: !s[p.key] }))}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"
                >
                  <Heart size={22} aria-hidden fill={on ? "#4D6BFF" : "none"} color={on ? "#4D6BFF" : "#C8CAD2"} />
                  <span className="font-bold">{(i + 3) * 2 + (on ? 1 : 0)}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
