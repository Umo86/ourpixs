import type { NextRequest } from "next/server";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { runCron } from "@/lib/cron";
import { cronAuthorized } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Media sweep: retries uploads whose previews / watermarks / transcodes are still pending or failed 10+ minutes later
 * (max 3 attempts each). Daily on Vercel Hobby; every 10 minutes on Pro (vercel.json). Logic: src/lib/media-processing.ts.
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return errorJson(401, "unauthorized", "Bad cron secret");
  try {
    return json({ ok: true, ...(await runCron("media")) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
