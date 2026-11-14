import type { MetadataRoute } from "next";
import { BRANDS, type Brand } from "./config";

/** The web app manifest body (site: src/app/manifest.ts; one guest gallery: src/app/g/[slug]/manifest.webmanifest). */
export function appManifest(brand: Brand, o: { start: string; scope: string; name: string; id?: string }): MetadataRoute.Manifest {
  const icons = `/icons/${brand}`;
  return {
    id: o.id ?? o.start,
    name: o.name,
    short_name: BRANDS[brand].name,
    start_url: o.start,
    scope: o.scope,
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    icons: [
      { src: `${icons}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${icons}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${icons}/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
