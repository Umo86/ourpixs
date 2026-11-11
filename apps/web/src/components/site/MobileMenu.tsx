"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { Button } from "@/components/ui/Button";
import type { NavItem } from "./NavLinks";

type Props = {
  items: NavItem[];
  tone: "light" | "dark";
  signIn: { href: string; label: string };
  start: { href: string; label: string };
  labels: { open: string; close: string; language: string };
};

/** Hamburger + drawer shown below md. */
export function MobileMenu({ items, tone, signIn, start, labels }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const dark = tone === "dark";
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${dark ? "text-white" : "text-ink"}`}
      >
        {open ? <X size={26} aria-hidden /> : <Menu size={26} aria-hidden />}
      </button>
      {open ? (
        <div
          id="mobile-menu"
          className={`absolute inset-x-0 top-full z-40 flex flex-col gap-1 border-t px-5 pb-6 pt-3 shadow-xl ${dark ? "border-surface-2 bg-ink text-white" : "border-tint bg-white text-ink"}`}
        >
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={pathname === i.href ? "page" : undefined}
              className="flex min-h-12 items-center text-2xl font-extrabold tracking-[-0.03em] no-underline"
            >
              {i.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center justify-between">
            <Link href={signIn.href} className="flex min-h-12 items-center font-semibold no-underline">{signIn.label}</Link>
            <LanguageSwitch tone={tone} label={labels.language} />
          </div>
          <Button href={start.href} size="lg" className="mt-2 w-full">{start.label}</Button>
        </div>
      ) : null}
    </div>
  );
}
