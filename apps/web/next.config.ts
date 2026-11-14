import type { NextConfig } from "next";

/**
 * The QR card PDFs (/api/v1/occasions/:id/cards.pdf) read the TTFs in assets/fonts at runtime, added the same way.
 *
 * Server-side media processing (src/lib/media-processing.ts) needs two things that file tracing can't discover on its own:
 * the ffmpeg-static binary (≈80 MB) and the pre-rendered watermark PNGs (assets/watermark). They are added only to the
 * functions that process media, which keeps every other function small (Vercel limit: 250 MB unzipped per function).
 */
const MEDIA_FILES = ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffmpeg-static/package.json", "./node_modules/ffmpeg-static/index.js", "./assets/watermark/**/*"];

const nextConfig: NextConfig = {
  // Test harness only (test/run.mjs builds into .next-e2e with test URLs baked in); unset everywhere else.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    // Marketing and demo photos hotlinked from Unsplash (as Unsplash requires).
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  // ffmpeg-static resolves its binary next to its own index.js, so it must not be bundled (sharp is external by default).
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/internal/media/process": MEDIA_FILES,
    "/api/cron/media": MEDIA_FILES,
    "/api/admin/cron/*": MEDIA_FILES,
    "/api/v1/g/*/uploads/complete": MEDIA_FILES,
    "/api/v1/occasions/*/uploads/complete": MEDIA_FILES,
    // Printable QR cards (pdf-lib): the embedded fonts (DejaVu, full Turkish coverage).
    "/api/v1/occasions/*/cards.pdf": ["./assets/fonts/**/*"],
  },
  async redirects() {
    // The venue / Partner plan was retired: one account subscription for everyone.
    return [
      { source: "/partners", destination: "/pricing", permanent: true },
      { source: "/partners/:path*", destination: "/pricing", permanent: true },
      { source: "/dashboard/partner", destination: "/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
