import type { MetadataRoute } from "next";
import { getBrand } from "@/i18n";
import { BRANDS } from "@/lib/config";
import { appManifest } from "@/lib/manifest";

/**
 * Web app manifest (/manifest.webmanifest): installable from the browser, brand-aware (the request host decides:
 * BizimResimler or Our Pixs). Guest pages link their own manifest that starts in their gallery
 * (src/app/g/[slug]/manifest.webmanifest/route.ts). There is deliberately NO service worker: nothing (API responses,
 * media, signed URLs, signed-in pages) is ever cached on the device.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getBrand();
  return appManifest(brand, { start: "/", scope: "/", name: BRANDS[brand].name });
}
