import type { ReactNode } from "react";

export function Notice({ tone = "info", children, className = "" }: { tone?: "info" | "error" | "success" | "blue"; children: ReactNode; className?: string }) {
  const tones = {
    info: "bg-tint text-ink",
    error: "bg-[#FDECEC] text-[#8A1C1C]",
    success: "bg-[#E8F6EE] text-[#165C33]",
    blue: "bg-royal text-white",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-5 py-4 text-[15px] leading-snug ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}
