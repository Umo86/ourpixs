import Link from "next/link";

type Props = {
  /** Pass BRANDS[brand].name */
  name: string;
  /** light = for white backgrounds, dark = for black / photo backgrounds */
  tone?: "light" | "dark";
  /** md = header, xl = footer wordmark */
  size?: "md" | "xl";
  href?: string | null;
  className?: string;
};

/** Brand wordmark: Bodoni italic with a blue dot. */
export function Logo({ name, tone = "light", size = "md", href = "/", className = "" }: Props) {
  const sizing = size === "xl" ? "text-[clamp(2.75rem,10vw,5.5rem)] leading-none tracking-[-0.03em]" : "text-[26px] leading-none tracking-[-0.02em] sm:text-[32px]";
  const color = tone === "dark" ? "text-white" : "text-ink";
  const dot = tone === "dark" ? "text-sky" : "text-royal";
  const inner = (
    <>
      {name}
      <span className={dot}>.</span>
    </>
  );
  const cls = `font-serif ${sizing} ${color} no-underline ${className}`;
  if (href === null) return <span className={cls}>{inner}</span>;
  return (
    <Link href={href} className={`${cls} rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky`} aria-label={name}>
      {inner}
    </Link>
  );
}
