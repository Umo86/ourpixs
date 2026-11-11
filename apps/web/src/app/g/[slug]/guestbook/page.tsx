import { requireJoined } from "@/lib/guest-guard";
import { GuestbookScreen } from "@/components/guest/GuestbookScreen";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireJoined((await params).slug);
  return <GuestbookScreen />;
}
