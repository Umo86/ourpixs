import { requireJoined } from "@/lib/guest-guard";
import { UploadScreen } from "@/components/guest/UploadScreen";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireJoined((await params).slug);
  return <UploadScreen />;
}
