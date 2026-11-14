import { SiteFooter, SiteHeader } from "@/components/site";
import NotFoundContent from "./(marketing)/not-found";

/**
 * 404 for everything outside the marketing group (a mistyped guest link /g/<slug>, an unknown /for/ or /guides/ page,
 * the dashboard…). Without it Next falls back to a bare error page with no <html lang>, brand or styles.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <SiteHeader variant="light" minimal />
      <main id="main" className="flex-1"><NotFoundContent /></main>
      <SiteFooter compact />
    </div>
  );
}
