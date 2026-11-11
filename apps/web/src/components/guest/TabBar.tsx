"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { useT } from "@/i18n/client";
import { useGuest } from "./GuestContext";

/** Bottom pill tab bar (mockups): Feed · Challenges · + · Camera · Book. */
export function TabBar() {
  const t = useT("guest");
  const { path, occasion } = useGuest();
  const here = usePathname();
  const tabs = [
    { href: path, label: t("tabs.feed"), exact: true },
    ...(occasion.missionsEnabled ? [{ href: `${path}/missions`, label: t("tabs.missions") }] : []),
    { href: `${path}/upload`, label: t("tabs.upload"), plus: true },
    ...(occasion.disposableShots ? [{ href: `${path}/camera`, label: t("tabs.camera") }] : []),
    { href: `${path}/guestbook`, label: t("tabs.book") },
  ];
  const active = (h: string, exact?: boolean) => {
    const p = decodeURIComponent(here);
    return exact ? p === h || p === `${h}/mine` : p.startsWith(h);
  };
  return (
    <nav aria-label={t("tabs.label")} className="fixed inset-x-0 bottom-0 z-40 px-3.5 pb-[max(14px,env(safe-area-inset-bottom))]">
      <ul className="m-0 mx-auto grid max-w-md list-none items-center rounded-full bg-surface p-2 shadow-2xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const on = active(tab.href, tab.exact);
          if (tab.plus) {
            return (
              <li key={tab.href} className="flex justify-center">
                <Link href={tab.href} aria-label={tab.label} aria-current={on ? "page" : undefined}
                  className={`flex h-[52px] w-[52px] items-center justify-center rounded-full no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${on ? "bg-white text-royal" : "bg-royal text-white"}`}>
                  <Plus size={28} aria-hidden />
                </Link>
              </li>
            );
          }
          return (
            <li key={tab.href}>
              <Link href={tab.href} aria-current={on ? "page" : undefined}
                className={`flex min-h-12 items-center justify-center rounded-full text-xs no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${on ? "bg-white font-extrabold text-ink" : "font-semibold text-muted-dark hover:text-white"}`}>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
