import type { NextRequest } from "next/server";
import { appManifest } from "@/lib/manifest";
import { BRANDS } from "@/lib/config";
import { getBrand } from "@/i18n";
import { occasionBySlug } from "@/lib/guest";
import { publicSlug } from "@/lib/occasion";
import { isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

/**
 * A guest gallery's manifest: "Add to Home Screen" on a gallery opens that gallery full screen (start_url and scope
 * are the gallery), named after the event. Same brand icons as the site manifest. Unknown slugs get the site's.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrand();
  let body = appManifest(brand, { start: "/", scope: "/", name: BRANDS[brand].name });
  if (!isDemo(slug)) {
    const o = await occasionBySlug(slug).catch(() => null);
    if (o && !o.deletedAt) {
      const path = `/g/${publicSlug(o)}`;
      body = appManifest(o.brand, { start: path, scope: path, name: o.title.slice(0, 60), id: path });
    }
  }
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
