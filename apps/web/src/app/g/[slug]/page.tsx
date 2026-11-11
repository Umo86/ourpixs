import { loadGuestContext } from "@/lib/guest-page";
import { Welcome } from "@/components/guest/Welcome";
import { Feed } from "@/components/guest/Feed";

export const dynamic = "force-dynamic";

export default async function GuestHome({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string }> }) {
  const { slug } = await params;
  const { guest } = await loadGuestContext(slug);
  const sp = await searchParams;
  return guest ? <Feed /> : <Welcome shareToken={typeof sp.k === "string" ? sp.k : undefined} />;
}
