import Link from "next/link";
import { getT } from "@/i18n";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";
import { buildMetadata } from "@/components/marketing/meta";
import { GUIDES, GUIDES_UI } from "@/content/guides";

export async function generateMetadata() {
  const { locale } = await getT("marketing");
  return buildMetadata({ title: GUIDES_UI[locale].metaTitle, description: GUIDES_UI[locale].metaDesc, path: "/guides" });
}

export default async function GuidesPage() {
  const { locale } = await getT("marketing");
  const ui = GUIDES_UI[locale];
  return (
    <Container className="flex flex-col gap-10 py-14 sm:py-20">
      <div className="flex flex-col gap-5">
        <Display as="h1" size="xl" accent={ui.accent}>{ui.title}</Display>
        <p className="m-0 max-w-[560px] text-lg leading-relaxed text-text-2">{ui.lead}</p>
      </div>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4 p-0">
        {GUIDES[locale].map((g, i) => (
          <li key={g.id}>
            <Link
              href={`/guides/${g.slug}`}
              className={`flex h-full min-h-[260px] flex-col justify-between gap-6 rounded-[28px] p-7 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2 ${i % 3 === 0 ? "bg-ink text-white" : i % 3 === 1 ? "bg-tint text-ink" : "bg-royal text-white"}`}
            >
              <span className="text-sm font-bold opacity-80">{ui.min.replace("{n}", String(g.minutes))}</span>
              <span className="flex flex-col gap-3">
                <span className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.035em]">{g.title}</span>
                <span className="text-[15px] leading-relaxed opacity-85">{g.description}</span>
                <span className="text-sm font-bold underline">{ui.read}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
