import { requireJoined } from "@/lib/guest-guard";
import { CameraScreen } from "@/components/guest/CameraScreen";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireJoined((await params).slug);
  return <CameraScreen />;
}
