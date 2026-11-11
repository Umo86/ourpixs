"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };
type Tone = "light" | "dark";

/** Desktop nav links with aria-current on the active page. */
export function NavLinks({ items, tone, className = "" }: { items: NavItem[]; tone: Tone; className?: string }) {
  const pathname = usePathname();
  const base = tone === "dark" ? "text-white" : "text-ink";
  const active = tone === "dark" ? "font-bold text-sky-soft" : "font-bold text-royal";
  return (
    <nav aria-label="Main" className={`items-center gap-7 text-[15px] font-medium ${className}`}>
      {items.map((i) => {
        const on = pathname === i.href || pathname.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-md py-2 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${on ? active : `${base} hover:opacity-70`}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
