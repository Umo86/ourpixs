import { requireJoined } from "@/lib/guest-guard";
import { MissionsScreen } from "@/components/guest/MissionsScreen";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireJoined((await params).slug);
  return <MissionsScreen />;
}
