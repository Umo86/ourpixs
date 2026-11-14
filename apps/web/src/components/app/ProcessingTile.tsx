import { Clock3, ImageOff } from "lucide-react";

/**
 * Neutral tile shown instead of a photo/video while its copies are being made (processing "pending"), or when no
 * preview could be made ("failed"). Never falls back to another copy.
 */
export function ProcessingTile({ failed, label, tone = "dark" }: { failed?: boolean; label: string; tone?: "dark" | "light" }) {
  const Icon = failed ? ImageOff : Clock3;
  return (
    <span className={`flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center text-[11px] font-bold leading-tight ${tone === "dark" ? "bg-surface-2 text-muted-dark" : "bg-tint text-text-2"}`}>
      <Icon size={20} aria-hidden className={failed ? "" : "animate-pulse"} />
      <span>{label}</span>
    </span>
  );
}
