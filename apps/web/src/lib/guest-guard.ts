import "server-only";
import { redirect } from "next/navigation";
import { loadGuestContext } from "./guest-page";

/** Sub-pages of the guest app need an open gallery and a joined guest; otherwise back to the welcome / "opens on" screen. */
export async function requireJoined(slug: string) {
  const ctx = await loadGuestContext(slug);
  const state = ctx.publicOccasion.galleryState;
  if (!ctx.guest || state === "not_open" || state === "unavailable") redirect(`/g/${slug}`);
  return ctx;
}
