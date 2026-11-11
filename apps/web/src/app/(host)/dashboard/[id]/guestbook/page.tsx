import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireMemberPage } from "@/lib/auth";
import { planOf } from "@/lib/occasion";
import { messagesWithNames } from "@/lib/queries";
import { toMessages } from "@/lib/serializers";
import { GuestbookClient } from "@/components/host/GuestbookClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("guestbook.metaTitle") };
}

export default async function GuestbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await requireMemberPage(id);
  if (!m) notFound();
  const { t } = await getT("host");
  const messages = await toMessages(await messagesWithNames(m.occasion.id));
  return (
    <Container size="narrow" className="flex flex-col gap-6 py-6 sm:py-8">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-3xl font-black tracking-[-0.03em]">{t("guestbook.title")} <span className="font-serif text-royal">{t("guestbook.titleAccent")}</span></h2>
        <p className="m-0 text-text-2">{planOf(m.occasion).voiceGuestbook ? t("guestbook.leadVoice") : t("guestbook.leadText")}</p>
      </div>
      <GuestbookClient occasionId={m.occasion.id} initial={messages} />
    </Container>
  );
}
