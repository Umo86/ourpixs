import { loadGuestContext } from "@/lib/guest-page";
import { Welcome } from "@/components/guest/Welcome";
import { Feed } from "@/components/guest/Feed";
import { NotOpen } from "@/components/guest/NotOpen";

export const dynamic = "force-dynamic";

export default async function GuestHome({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string }> }) {
  const { slug } = await params;
  const { guest, publicOccasion } = await loadGuestContext(slug);
  const sp = await searchParams;
  // Before the gallery opens (not paid yet, or paid and before opensAt) and after a refund/deletion: a friendly page.
  if (publicOccasion.galleryState === "not_open" || publicOccasion.galleryState === "unavailable") return <NotOpen />;
  return guest ? <Feed /> : <Welcome shareToken={typeof sp.k === "string" ? sp.k : undefined} />;
}
