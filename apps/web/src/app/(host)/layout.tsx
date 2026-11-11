import type { Metadata } from "next";
import { CookieNotice } from "@/components/site";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      {children}
      <div className="print:hidden"><CookieNotice /></div>
    </div>
  );
}
