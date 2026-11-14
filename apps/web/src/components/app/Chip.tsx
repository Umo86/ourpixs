"use client";
import type { ReactNode } from "react";

/** Filter chip / pill toggle. */
export function Chip({ pressed, onClick, children, tone = "light", className = "" }: { pressed: boolean; onClick: () => void; children: ReactNode; tone?: "light" | "dark"; className?: string }) {
  const on = "border-royal bg-royal text-white";
  const off = tone === "dark" ? "border-[#3A3F52] bg-transparent text-white hover:border-white" : "border-[#D5D8E2] bg-white text-ink hover:border-ink";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${pressed ? on : off} ${className}`}
    >
      {children}
    </button>
  );
}
