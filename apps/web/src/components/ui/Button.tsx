import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "light" | "dark";
export type ButtonSize = "md" | "lg";

type Common = { variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode };
type AsLink = Common & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;
type AsButton = Common & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;
export type ButtonProps = AsLink | AsButton;

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-royal text-white hover:bg-royal-dark",
  secondary: "border-[1.5px] border-ink text-ink hover:bg-ink hover:text-white",
  // inherits the surrounding text colour (use on photos / dark / blue sections)
  ghost: "border-[1.5px] border-current text-inherit hover:bg-current/10",
  light: "bg-white text-ink hover:bg-tint",
  dark: "bg-ink text-white hover:bg-surface-2",
};
const SIZES: Record<ButtonSize, string> = {
  md: "min-h-11 px-6 py-3 text-[15px] font-bold",
  lg: "min-h-14 px-7 py-4 text-base font-extrabold sm:px-9 sm:py-5 sm:text-lg",
};

/**
 * Pill button. Pass `href` to render a link (next/link for internal, <a> for http/mailto/tel), otherwise a <button>.
 * Variants: primary | secondary | ghost | light | dark. Sizes: md | lg.
 */
export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className = "", children } = props;
  const cls = `inline-flex items-center justify-center gap-2 rounded-full text-center no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (props.href !== undefined) {
    const { variant: _v, size: _s, className: _c, children: _ch, href, ...rest } = props;
    void _v; void _s; void _c; void _ch;
    if (/^(https?:|mailto:|tel:)/.test(href)) {
      return <a href={href} className={cls} {...rest}>{children}</a>;
    }
    return <Link href={href} className={cls} {...rest}>{children}</Link>;
  }
  const { variant: _v, size: _s, className: _c, children: _ch, href: _h, ...rest } = props;
  void _v; void _s; void _c; void _ch; void _h;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}
