import { requireJoined } from "@/lib/guest-guard";
import { MineScreen } from "@/components/guest/MineScreen";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireJoined((await params).slug);
  return <MineScreen />;
}
