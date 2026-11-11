import Link from "next/link";
import { LanguageSwitch } from "@/components/ui";

/** Header for white-label (partner) events: venue logo/name + EN/TR, no platform logo. */
export function BrandedBar({ name, logoUrl, label }: { name: string | null; logoUrl: string | null; label: string }) {
  return (
    <header className="relative z-30 bg-ink text-white">
      <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <span className="flex min-h-11 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl ? <img src={logoUrl} alt={name || ""} className="h-9 max-w-40 object-contain" /> : null}
          {name && !logoUrl ? <span className="font-serif text-[26px] leading-none">{name}</span> : null}
        </span>
        <LanguageSwitch tone="dark" label={label} />
      </div>
    </header>
  );
}

export function PoweredBy({ show, brand, label }: { show: boolean; brand: string; label: string }) {
  if (!show) return <div className="h-6" />;
  return (
    <footer className="py-6 text-center text-xs text-muted-dark">
      <Link href="/" className="rounded-md px-2 py-2 text-muted-dark no-underline hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky" aria-label={label}>{label.replace(brand, "")}<span className="font-serif text-sm text-white">{brand}</span></Link>
    </footer>
  );
}
