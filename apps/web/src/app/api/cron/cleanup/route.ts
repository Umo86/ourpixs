import type { NextRequest } from "next/server";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { runCron } from "@/lib/cron";
import { cronAuthorized } from "../auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily: deletes files of lapsed accounts, purges abandoned uploads and stale rows. Logic in src/lib/cron.ts (runCleanup). */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return errorJson(401, "unauthorized", "Bad cron secret");
  try {
    return json({ ok: true, ...(await runCron("cleanup")) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
