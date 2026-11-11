import "server-only";
import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function cronAuthorized(req: NextRequest): boolean {
  const s = process.env.CRON_SECRET;
  if (!s) return false;
  return safeEqual(req.headers.get("authorization") || "", `Bearer ${s}`);
}
