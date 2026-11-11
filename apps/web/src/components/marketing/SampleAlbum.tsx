import Image from "next/image";
import { MEDIA } from "./constants";

type Props = { logo: string; venue: string; album: string; at: string; by: string; alt: string };

/** Mock-up of a co-branded guest album: venue logo, couple names "at Venue", sample photos. Decorative sample content. */
export function SampleAlbum({ logo, venue, album, at, by, alt }: Props) {
  const photos = [MEDIA.wedding, MEDIA.selfie, MEDIA.family, MEDIA.birthday];
  return (
    <figure role="img" aria-label={alt} className="m-0 mx-auto w-full max-w-[340px] rounded-[36px] border-[6px] border-ink bg-ink p-0 shadow-2xl">
      <div className="overflow-hidden rounded-[30px] bg-ink text-white">
        <div className="relative h-44 bg-[#1B2440]">
          <Image src={MEDIA.couple} alt="" fill sizes="340px" className="object-cover opacity-70 grayscale" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/20 to-ink/80" />
          <span className="absolute left-4 top-4 rounded-full border border-dashed border-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">{logo}</span>
          <div className="absolute inset-x-4 bottom-3">
            <p className="m-0 text-[28px] font-black leading-none tracking-[-0.04em]">{album}</p>
            <p className="m-0 mt-1 text-sm text-muted-dark">{at} <span className="font-serif text-base text-sky-soft">{venue}</span></p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-3">
          {photos.map((p) => (
            <div key={p} className="relative aspect-square overflow-hidden rounded-2xl">
              <Image src={p} alt="" fill sizes="150px" className="object-cover" />
            </div>
          ))}
        </div>
        <p className="m-0 px-4 pb-4 text-xs text-muted-dark">{by}</p>
      </div>
    </figure>
  );
}
