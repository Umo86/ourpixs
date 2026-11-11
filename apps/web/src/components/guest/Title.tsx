/** Event title with "&" in Bodoni italic, coloured. */
export function Title({ text, accent = "#8097FF" }: { text: string; accent?: string }) {
  const parts = text.split(/(\s&\s)/);
  return (
    <>
      {parts.map((p, i) => (p === " & " ? <span key={i} className="font-serif font-normal" style={{ color: accent }}> &amp; </span> : <span key={i}>{p}</span>))}
    </>
  );
}
