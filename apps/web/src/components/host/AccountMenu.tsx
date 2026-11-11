"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, LayoutGrid, Plus } from "lucide-react";
import { useT } from "@/i18n/client";
import { initial } from "@/lib/client/format";

export function AccountMenu({ email }: { email: string }) {
  const t = useT("host");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function signOut() {
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }

  const item = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-ink no-underline hover:bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account.menu")}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink text-[15px] font-extrabold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2"
      >
        {initial(email)}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 rounded-3xl border border-[#E6E8EF] bg-white p-2 shadow-xl">
          <p className="m-0 truncate px-3 py-2 text-xs text-muted">{email}</p>
          <Link role="menuitem" href="/dashboard" className={item} onClick={() => setOpen(false)}><LayoutGrid size={18} aria-hidden />{t("account.events")}</Link>
          <Link role="menuitem" href="/dashboard/new" className={item} onClick={() => setOpen(false)}><Plus size={18} aria-hidden />{t("account.newEvent")}</Link>
          <button role="menuitem" type="button" className={item} onClick={signOut}><LogOut size={18} aria-hidden />{t("account.signOut")}</button>
        </div>
      ) : null}
    </div>
  );
}
