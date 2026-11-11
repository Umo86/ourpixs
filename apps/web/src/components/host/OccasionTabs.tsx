"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Monitor } from "lucide-react";

type Tab = { href: string; label: string; exact?: boolean };

export function OccasionTabs({ tabs, wall, label, lockedLabel }: { tabs: Tab[]; wall: { href: string; label: string; locked?: boolean }; label: string; lockedLabel: string }) {
  const path = usePathname();
  const base = "inline-flex min-h-11 flex-none items-center gap-2 whitespace-nowrap rounded-full px-5 text-[14px] font-bold no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";
  return (
    <nav aria-label={label} className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="m-0 flex list-none gap-2 p-0">
        {tabs.map((tab) => {
          const active = tab.exact ? path === tab.href : path.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link href={tab.href} aria-current={active ? "page" : undefined} className={`${base} ${active ? "bg-ink text-white" : "bg-tint text-ink hover:bg-[#E4E8F5]"}`}>{tab.label}</Link>
            </li>
          );
        })}
        <li>
          {wall.locked ? (
            <Link href={wall.href} className={`${base} bg-tint text-muted`} aria-label={`${wall.label} (${lockedLabel})`}><Lock size={16} aria-hidden />{wall.label}</Link>
          ) : (
            <a href={wall.href} target="_blank" rel="noopener" className={`${base} bg-royal text-white hover:bg-royal-dark`}><Monitor size={16} aria-hidden />{wall.label}</a>
          )}
        </li>
      </ul>
    </nav>
  );
}
