import type { ReactNode } from "react";

type Tone = "royal" | "ink" | "white" | "tint";
const TONES: Record<Tone, string> = {
  royal: "bg-royal text-white",
  ink: "bg-ink text-white",
  white: "bg-white text-ink",
  tint: "bg-tint text-ink",
};

type Props = {
  tone?: Tone;
  /** degrees; 0 renders a plain badge */
  rotate?: number;
  /** UPPERCASE tracked label style (hero stickers) vs. bold sentence style */
  caps?: boolean;
  className?: string;
  children: ReactNode;
};

/** Rotated "sticker" badge. `Badge` is the same component with no rotation by default. */
export function Sticker({ tone = "royal", rotate = -3, caps = false, className = "", children }: Props) {
  return (
    <span
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
      className={`inline-block rounded-full px-4 py-2 text-[13px] font-bold ${caps ? "uppercase tracking-[0.12em]" : ""} ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Badge(props: Omit<Props, "rotate"> & { rotate?: number }) {
  return <Sticker rotate={0} {...props} />;
}
