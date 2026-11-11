"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { HelpGroup } from "@/content/help";

type Labels = { search: string; placeholder: string; none: string; contact: string; email: string; count: string };

function norm(s: string) {
  return s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
}

/** Grouped FAQ with client-side search. Native <details> keeps it accessible without JS. */
export function HelpCentre({ groups, labels }: { groups: HelpGroup[]; labels: Labels }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => norm(i.q + " " + i.a).includes(n)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);
  const total = filtered.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex flex-col gap-10">
      <div className="relative max-w-[560px]">
        <label htmlFor="help-search" className="sr-only">{labels.search}</label>
        <Search aria-hidden size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="help-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.placeholder}
          className="block min-h-14 w-full rounded-full border-[1.5px] border-ink bg-white py-3 pl-12 pr-5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"
        />
      </div>
      <p role="status" className="m-0 text-sm text-muted">{labels.count.replace("{n}", String(total))}</p>
      {total === 0 ? (
        <p className="m-0 text-lg text-text-2">{labels.none}</p>
      ) : (
        filtered.map((g) => (
          <section key={g.id} aria-labelledby={`help-${g.id}`} className="flex flex-col">
            <h2 id={`help-${g.id}`} className="m-0 mb-3 text-3xl font-black tracking-[-0.04em]">{g.title}</h2>
            {g.items.map((i) => (
              <details key={i.q} className="group border-t-[1.5px] border-ink py-1" open={q.trim() ? true : undefined}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-bold tracking-[-0.02em] [&::-webkit-details-marker]:hidden">
                  {i.q}
                  <span aria-hidden className="text-2xl text-royal transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="m-0 pb-4 text-[16.5px] leading-relaxed text-text-2">{i.a}</p>
              </details>
            ))}
          </section>
        ))
      )}
      <p className="m-0 text-lg">{labels.contact} <a href={`mailto:${labels.email}`} className="font-bold text-royal underline">{labels.email}</a></p>
    </div>
  );
}
