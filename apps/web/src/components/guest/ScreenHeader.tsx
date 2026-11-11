import Link from "next/link";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function ScreenHeader({ title, accent, sub, close, closeLabel, right }: { title: string; accent?: string; sub?: ReactNode; close?: string; closeLabel?: string; right?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 pt-1">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[34px] font-black leading-none tracking-[-0.05em]">{title} {accent ? <span className="font-serif font-normal text-sky-soft">{accent}</span> : null}</h1>
        {sub ? <span className="text-sm text-muted-dark">{sub}</span> : null}
      </div>
      {right}
      {close ? (
        <Link href={close} aria-label={closeLabel} className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><X size={20} aria-hidden /></Link>
      ) : null}
    </header>
  );
}
