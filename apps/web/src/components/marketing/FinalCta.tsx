import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";

/** Full-width blue closing call to action. */
export function FinalCta({ title, accent, cta, href, note, id }: { title: ReactNode; accent: ReactNode; cta: string; href: string; note?: string; id?: string }) {
  return (
    <section id={id} className="bg-royal text-white">
      <Container className="flex flex-col items-center gap-8 py-20 text-center sm:py-28 lg:py-32">
        <Display as="h2" size="cta" tone="blue" accent={accent} className="max-w-[1150px]">{title}</Display>
        <Button href={href} variant="light" size="lg" className="text-royal!">{cta}</Button>
        {note ? <p className="m-0 text-sm uppercase tracking-[0.12em] text-[#E3E8FF]">{note}</p> : null}
      </Container>
    </section>
  );
}
