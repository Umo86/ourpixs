"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ClipboardList, Flag, Inbox, LayoutDashboard, PartyPopper, SlidersHorizontal, Users } from "lucide-react";

const ICONS = { overview: LayoutDashboard, users: Users, events: PartyPopper, moderation: Flag, enquiries: Inbox, settings: SlidersHorizontal, audit: ClipboardList, system: Activity } as const;
export type AdminNavKey = keyof typeof ICONS;

/** Left column on desktop, a horizontal pill row on mobile. */
export function AdminNav({ items, label }: { items: { key: AdminNavKey; href: string; label: string }[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="-mx-5 mb-6 overflow-x-auto px-5 sm:-mx-8 sm:px-8 md:sticky md:top-6 md:mx-0 md:mb-0 md:self-start md:overflow-visible md:px-0">
      <ul className="m-0 flex list-none gap-2 p-0 md:flex-col md:gap-1">
        {items.map((it) => {
          const Icon = ICONS[it.key];
          const active = it.href === "/admin" ? path === "/admin" : path === it.href || path.startsWith(`${it.href}/`);
          return (
            <li key={it.key}>
              <Link href={it.href} aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 w-full flex-none items-center gap-3 whitespace-nowrap rounded-full px-4 text-[14px] font-bold no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky md:px-4 ${active ? "bg-ink text-white" : "bg-tint text-ink hover:bg-[#E4E8F5] md:bg-transparent"}`}>
                <Icon size={18} aria-hidden />{it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
