import type { NextRequest } from "next/server";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { runCron } from "@/lib/cron";
import { cronAuthorized } from "../auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Sequential emails / storage deletions: give the daily job the full window (docs/SETUP.md: plan maximum). */
export const maxDuration = 300;

/** Daily event-package jobs ("gallery ended" emails, deletion reminders). Logic in src/lib/cron.ts (runExpiry). */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return errorJson(401, "unauthorized", "Bad cron secret");
  try {
    return json({ ok: true, ...(await runCron("expiry")) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
