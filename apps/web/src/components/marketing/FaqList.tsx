export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="flex flex-col">
      {items.map((i) => (
        <div key={i.q} className="flex flex-wrap gap-x-10 gap-y-2 border-t-[1.5px] border-ink py-6">
          <h3 className="m-0 min-w-0 flex-[1_1_280px] text-xl font-extrabold leading-tight tracking-[-0.03em]">{i.q}</h3>
          <p className="m-0 min-w-0 flex-[1_1_300px] text-[16.5px] leading-relaxed text-text-2">{i.a}</p>
        </div>
      ))}
    </div>
  );
}
