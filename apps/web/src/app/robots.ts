import type { MetadataRoute } from "next";
import { getBrand } from "@/i18n";
import { brandBaseUrl } from "@/lib/config";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = brandBaseUrl(await getBrand());
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/g/", "/s/", "/d/", "/wall", "/dashboard", "/admin", "/api"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
