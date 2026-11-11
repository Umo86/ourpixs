"use client";
import { useEffect, useRef } from "react";

/** Decorative hero video. Autoplays muted/looped unless the visitor prefers reduced motion (then the poster stays). */
export function HeroVideo({ poster, className = "" }: { poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (mq.matches) v.pause();
      else v.play().catch(() => {});
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return (
    <video ref={ref} muted loop playsInline preload="metadata" poster={poster} aria-hidden="true" tabIndex={-1} className={className}>
      <source src="/media/hero.mp4" type="video/mp4" />
      <source src="https://videos.pexels.com/video-files/9003393/9003393-hd_1280_720_25fps.mp4" type="video/mp4" />
    </video>
  );
}
