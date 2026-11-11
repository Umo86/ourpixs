"use client";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { THEMES } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { START_HREF } from "@/components/site/constants";
import { TEMPLATES, type TemplateDesign } from "@/content/templates";
import { useLocale } from "@/i18n/client";

type Copy = { headline: string; sub: string; names: string; sample: string; print: string; use: string; designLabel: string };

function Card({ d, copy, qrSvg, qrAlt, locale }: { d: TemplateDesign; copy: Copy; qrSvg: string; qrAlt: string; locale: "en" | "tr" }) {
  const th = THEMES[d.theme];
  const dark = th.fg === "#FFFFFF";
  const qrTile = (
    <div role="img" aria-label={qrAlt} className="rounded-2xl bg-white p-3 shadow-sm [&>svg]:block [&>svg]:size-full" style={{ width: d.layout === "bold" ? "58%" : "52%", aspectRatio: "1" }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
  );
  const text = (
    <>
      <p className="m-0 font-serif text-[22px] leading-none" style={{ color: th.accent }}>{copy.names}</p>
      <p className="m-0 font-black leading-[0.95] tracking-[-0.04em]" style={{ fontSize: d.layout === "bold" ? "30px" : "24px" }}>{copy.headline}</p>
      <p className="m-0 text-[13px] opacity-80">{copy.sub}</p>
    </>
  );
  return (
    <div
      data-print-id={d.id}
      className="relative flex aspect-[148/210] w-full flex-col items-center justify-between gap-3 overflow-hidden rounded-[28px] p-6 text-center"
      style={{ background: th.bg, color: th.fg, border: dark ? "none" : "1px solid #E3E5EE" }}
    >
      {d.layout === "split" ? (
        <>
          <div className="flex w-full flex-col items-center gap-2 pt-2">{text}</div>
          {qrTile}
        </>
      ) : d.layout === "bold" ? (
        <>
          <div className="flex w-full flex-col items-center gap-2 pt-2">{text}</div>
          {qrTile}
        </>
      ) : (
        <>
          {qrTile}
          <div className="flex w-full flex-col items-center gap-2 pb-2">{text}</div>
        </>
      )}
      <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: th.accent, color: th.accent === "#FFFFFF" || th.accent === "#8097FF" ? "#0A0A0A" : "#FFFFFF" }} data-hide-print>
        {copy.sample}
      </span>
      <span lang={locale} className="sr-only">{d.name[locale]}</span>
    </div>
  );
}

export function TemplateGallery({ copy, qrSvg, qrAlt }: { copy: Copy; qrSvg: string; qrAlt: string }) {
  const { locale } = useLocale();
  const [printing, setPrinting] = useState<string | null>(null);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    const id = window.setTimeout(() => window.print(), 50);
    return () => { window.removeEventListener("afterprint", done); window.clearTimeout(id); };
  }, [printing]);

  return (
    <>
      {printing ? (
        <style>{`
          @page { size: A5 portrait; margin: 0; }
          @media print {
            html, body { background: #fff !important; }
            body * { visibility: hidden !important; }
            [data-print-id="${printing}"], [data-print-id="${printing}"] * { visibility: visible !important; }
            [data-print-id="${printing}"] { position: fixed !important; left: 0; top: 0; width: 148mm !important; height: 210mm !important; aspect-ratio: auto !important; border-radius: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 14mm !important; }
            [data-hide-print] { display: none !important; }
          }
        `}</style>
      ) : null}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-6 p-0">
        {TEMPLATES.map((d) => (
          <li key={d.id} className="flex flex-col gap-4">
            <Card d={d} copy={copy} qrSvg={qrSvg} qrAlt={qrAlt} locale={locale} />
            <div className="flex flex-wrap items-center gap-3">
              <p className="m-0 mr-auto text-lg font-extrabold tracking-[-0.02em]">{copy.designLabel}: {d.name[locale]}</p>
              <Button variant="secondary" onClick={() => setPrinting(d.id)}><Printer size={16} aria-hidden />{copy.print}</Button>
              <Button href={START_HREF}>{copy.use}</Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
