/** Renders a title with "&" set in Bodoni italic (V2 type treatment). */
export function AmpTitle({ title, accent }: { title: string; accent?: string }) {
  const parts = title.split(/(\s&\s)/);
  return (
    <>
      {parts.map((p, i) => (p === " & " ? <span key={i} className="font-serif" style={{ color: accent }}> &amp; </span> : <span key={i}>{p}</span>))}
    </>
  );
}

export type QrCopy = {
  eyebrow: string; title: string; sticker: string; headline: string; accent: string; body: string; secondary: string;
  /** Wordmark at the bottom (platform brand, venue name, or empty when hidden). */
  brand: string; url: string; poweredBy?: string;
};
type Theme = { bg: string; fg: string; accent: string };

/** Accent that reads on white for themes whose accent is white/near-white. */
function inkAccent(theme: Theme) {
  return theme.accent.toUpperCase() === "#FFFFFF" ? theme.bg : theme.accent;
}

/**
 * One QR card (A6) or poster (A4). Top band = cover photo (or theme colour) with the names; below = QR + bilingual copy.
 * Sizes use mm so print output is exact.
 */
export function QrArtwork({ qr, copy, size, cover, theme, logo, layout = "centered" }: { qr: string; copy: QrCopy; size: "card" | "poster"; cover?: string | null; theme: Theme; logo?: string | null; layout?: "centered" | "split" | "bold" }) {
  const poster = size === "poster";
  const S = (card: string, big: string) => (poster ? big : card);
  const accent = inkAccent(theme);
  if (layout !== "centered") return <SolidArtwork qr={qr} copy={copy} poster={poster} theme={theme} logo={logo} layout={layout} />;
  return (
    <div className="qr-art relative flex h-full w-full flex-col overflow-hidden bg-white text-center text-ink">
      <div className="relative flex flex-col items-center justify-end" style={{ height: S("50mm", "112mm"), background: theme.bg, color: cover ? "#FFFFFF" : theme.fg, padding: S("5mm 6mm", "12mm 14mm") }}>
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,10,10,.82), rgba(10,10,10,.05) 70%)" }} />
          </>
        ) : null}
        <span className="relative font-bold uppercase" style={{ fontSize: S("2.5mm", "4.8mm"), letterSpacing: "0.18em", opacity: 0.92 }}>{copy.eyebrow}</span>
        <h2 className="relative m-0 font-black" style={{ fontSize: S("9.5mm", "20mm"), lineHeight: 0.92, letterSpacing: "-0.04em", marginTop: S("1.5mm", "3mm") }}>
          <AmpTitle title={copy.title} accent={cover ? "#8097FF" : theme.accent} />
        </h2>
      </div>
      <div className="flex flex-1 flex-col items-center" style={{ padding: S("4.5mm 6mm 4mm", "10mm 14mm 10mm") }}>
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="" style={{ width: S("40mm", "88mm"), height: S("40mm", "88mm"), borderRadius: S("3mm", "6mm"), border: `${S("0.6mm", "1.2mm")} solid #0A0A0A`, padding: S("1.5mm", "3mm"), background: "#fff" }} />
          <span className="absolute rounded-full font-extrabold text-white" style={{ background: accent, right: S("-7mm", "-14mm"), top: S("-3mm", "-6mm"), transform: "rotate(10deg)", fontSize: S("2.8mm", "5.6mm"), padding: S("1.4mm 3mm", "2.8mm 5.6mm") }}>{copy.sticker}</span>
        </div>
        <p className="m-0 font-black" style={{ fontSize: S("5.6mm", "11.5mm"), lineHeight: 1, letterSpacing: "-0.03em", marginTop: S("4mm", "9mm") }}>
          {copy.headline} <span className="font-serif" style={{ color: accent }}>{copy.accent}</span>
        </p>
        <p className="m-0 text-text-2" style={{ fontSize: S("2.7mm", "5.2mm"), lineHeight: 1.35, marginTop: S("1.6mm", "3.5mm") }}>{copy.body}</p>
        <p className="m-0 text-muted" style={{ fontSize: S("2.4mm", "4.5mm"), lineHeight: 1.35, marginTop: S("0.8mm", "1.6mm") }}>{copy.secondary}</p>
        <div className="mt-auto flex w-full items-center justify-between gap-2" style={{ borderTop: `${S("0.5mm", "1mm")} solid ${accent}`, paddingTop: S("2mm", "4mm") }}>
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="" style={{ height: S("6mm", "12mm"), maxWidth: S("26mm", "60mm"), objectFit: "contain" }} /> : null}
            {copy.brand ? <span className="font-serif" style={{ fontSize: S("4.2mm", "8mm") }}>{copy.brand}<span style={{ color: accent }}>.</span></span> : null}
          </span>
          <span className="flex flex-col items-end">
            <span className="font-semibold text-muted" style={{ fontSize: S("2.3mm", "4.3mm") }}>{copy.url}</span>
            {copy.poweredBy ? <span className="text-muted" style={{ fontSize: S("1.8mm", "3.2mm") }}>{copy.poweredBy}</span> : null}
          </span>
        </div>
      </div>
    </div>
  );
}

/** "split" and "bold" designs from the marketing templates: full-colour card in the theme, no photo band. */
function SolidArtwork({ qr, copy, poster, theme, logo, layout }: { qr: string; copy: QrCopy; poster: boolean; theme: Theme; logo?: string | null; layout: "split" | "bold" }) {
  const S = (card: string, big: string) => (poster ? big : card);
  const bold = layout === "bold";
  const qrTile = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={qr} alt="" style={{ width: S(bold ? "52mm" : "44mm", bold ? "115mm" : "96mm"), height: S(bold ? "52mm" : "44mm", bold ? "115mm" : "96mm"), borderRadius: S("4mm", "8mm"), padding: S("2.5mm", "5mm"), background: "#fff" }} />
  );
  const text = (
    <div className="flex flex-col items-center" style={{ gap: S("2mm", "4mm") }}>
      <span className="font-bold uppercase" style={{ fontSize: S("2.5mm", "4.8mm"), letterSpacing: "0.18em", opacity: 0.85 }}>{copy.eyebrow}</span>
      <p className="m-0 font-serif" style={{ fontSize: S("8mm", "17mm"), lineHeight: 1, color: theme.accent }}>{copy.title}</p>
      <p className="m-0 font-black" style={{ fontSize: S(bold ? "8mm" : "6.4mm", bold ? "17mm" : "13mm"), lineHeight: 0.95, letterSpacing: "-0.04em" }}>{copy.headline} {copy.accent}</p>
      <p className="m-0" style={{ fontSize: S("2.7mm", "5.2mm"), opacity: 0.85 }}>{copy.body}</p>
      <p className="m-0" style={{ fontSize: S("2.4mm", "4.5mm"), opacity: 0.65 }}>{copy.secondary}</p>
    </div>
  );
  return (
    <div className="qr-art flex h-full w-full flex-col items-center justify-between text-center" style={{ background: theme.bg, color: theme.fg, padding: S("7mm 6mm 5mm", "16mm 14mm 12mm") }}>
      {bold ? <>{text}{qrTile}</> : <>{qrTile}{text}</>}
      <div className="flex w-full items-center justify-between gap-2" style={{ borderTop: `${S("0.4mm", "0.8mm")} solid ${theme.accent}`, paddingTop: S("2mm", "4mm") }}>
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="" style={{ height: S("6mm", "12mm"), maxWidth: S("26mm", "60mm"), objectFit: "contain" }} /> : null}
          {copy.brand ? <span className="font-serif" style={{ fontSize: S("4.2mm", "8mm") }}>{copy.brand}</span> : null}
        </span>
        <span className="flex flex-col items-end" style={{ opacity: 0.8 }}>
          <span className="font-semibold" style={{ fontSize: S("2.3mm", "4.3mm") }}>{copy.url}</span>
          {copy.poweredBy ? <span style={{ fontSize: S("1.8mm", "3.2mm") }}>{copy.poweredBy}</span> : null}
        </span>
      </div>
    </div>
  );
}
