import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";

export type LegalSection = { h: string; p?: string[]; list?: string[] };

export function LegalPage({ title, accent, updated, intro, sections }: { title: string; accent: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <Container size="narrow" className="py-14 sm:py-20">
      <p className="m-0 mb-4 text-sm font-semibold text-muted">{updated}</p>
      <Display as="h1" size="lg" accent={accent}>{title}</Display>
      <p className="mt-6 text-lg leading-relaxed text-text-2">{intro}</p>
      <div className="mt-10 flex flex-col gap-10">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="m-0 mb-3 text-2xl font-extrabold tracking-[-0.03em]">{s.h}</h2>
            {s.p?.map((p) => <p key={p} className="my-3 text-[16.5px] leading-relaxed text-text-2">{p}</p>)}
            {s.list ? (
              <ul className="my-3 flex list-disc flex-col gap-2 pl-6 text-[16.5px] leading-relaxed text-text-2">
                {s.list.map((l) => <li key={l}>{l}</li>)}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </Container>
  );
}
