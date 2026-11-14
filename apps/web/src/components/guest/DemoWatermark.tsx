import { BRANDS, type Brand } from "@/lib/config";

/**
 * The demo album (/g/demo) uses stock photos that never go through the media pipeline,
 * so it imitates the guest-preview watermark with an overlay. Real events get the
 * watermark baked into the image server-side (src/lib/watermark.ts).
 */
export function DemoWatermark({ brand, size = "lg" }: { brand: Brand; size?: "lg" | "sm" }) {
  const name = BRANDS[brand].name;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {size === "lg" ? (
        <span className="absolute inset-[-50%] flex rotate-[-24deg] flex-col justify-center gap-16 opacity-[0.14]">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="whitespace-nowrap text-center text-2xl font-extrabold tracking-[-0.02em] text-white">
              {`${name}   ${name}   ${name}   ${name}`}
            </span>
          ))}
        </span>
      ) : null}
      <span
        className={`absolute font-extrabold tracking-[-0.02em] text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)] ${size === "lg" ? "bottom-3.5 right-3.5 text-base" : "bottom-6 right-1.5 text-[9px]"}`}
      >
        {name}
      </span>
    </span>
  );
}
