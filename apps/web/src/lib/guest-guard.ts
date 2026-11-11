import "server-only";
import { redirect } from "next/navigation";
import { loadGuestContext } from "./guest-page";

/** Sub-pages of the guest app need a joined guest; otherwise back to the welcome screen. */
export async function requireJoined(slug: string) {
  const ctx = await loadGuestContext(slug);
  if (!ctx.guest) redirect(`/g/${slug}`);
  return ctx;
}
