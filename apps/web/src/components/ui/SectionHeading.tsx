import type { ReactNode } from "react";

export type HeadingSize = "hero" | "cta" | "xl" | "lg" | "md" | "sm";
export type HeadingTone = "light" | "dark" | "blue";

const SIZES: Record<HeadingSize, string> = {
  hero: "text-[clamp(3.25rem,10.5vw,8.75rem)] leading-[0.88] tracking-[-0.045em]",
  cta: "text-[clamp(2.6rem,8.2vw,7.25rem)] leading-[0.9] tracking-[-0.045em]",
  xl: "text-[clamp(2.6rem,6.2vw,5.25rem)] leading-[0.95] tracking-[-0.04em]",
  lg: "text-[clamp(2.4rem,5.2vw,4.5rem)] leading-[0.95] tracking-[-0.04em]",
  md: "text-[clamp(2.1rem,4.2vw,3.75rem)] leading-[0.95] tracking-[-0.04em]",
  sm: "text-[clamp(1.9rem,3.4vw,3.25rem)] leading-[1] tracking-[-0.04em]",
};
const ACCENT: Record<HeadingTone, string> = { light: "text-royal", dark: "text-sky-soft", blue: "text-white" };

type DisplayProps = {
  as?: "h1" | "h2" | "h3";
  size?: HeadingSize;
  tone?: HeadingTone;
  /** The Bodoni italic emphasis words, rendered after `children`. */
  accent?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/** Huge 900-weight Inter Tight headline with Bodoni italic emphasis. */
export function Display({ as: Tag = "h2", size = "xl", tone = "light", accent, className = "", children }: DisplayProps) {
  return (
    <Tag className={`m-0 break-words font-black ${SIZES[size]} ${className}`}>
      {children}
      {children && accent ? " " : null}
      {accent ? <span className={`font-serif tracking-[-0.025em] ${ACCENT[tone]}`}>{accent}</span> : null}
    </Tag>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`block text-[13px] font-bold uppercase tracking-[0.16em] ${className}`}>{children}</span>;
}

type SectionHeadingProps = DisplayProps & {
  eyebrow?: ReactNode;
  /** Short supporting paragraph under the headline. */
  lead?: ReactNode;
  align?: "left" | "center";
};

/** Optional eyebrow + Display headline + optional lead paragraph. */
export function SectionHeading({ eyebrow, lead, align = "left", tone = "light", className = "", ...display }: SectionHeadingProps) {
  const leadColor = tone === "light" ? "text-text-2" : tone === "dark" ? "text-muted-dark" : "text-white/90";
  return (
    <div className={`flex flex-col gap-4 ${align === "center" ? "items-center text-center" : ""} ${className}`}>
      {eyebrow ? <Eyebrow className={tone === "light" ? "text-royal" : tone === "dark" ? "text-sky-soft" : "text-white/80"}>{eyebrow}</Eyebrow> : null}
      <Display tone={tone} {...display} />
      {lead ? <p className={`m-0 max-w-[560px] text-lg leading-relaxed ${leadColor}`}>{lead}</p> : null}
    </div>
  );
}
