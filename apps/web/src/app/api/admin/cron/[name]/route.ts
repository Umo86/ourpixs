import { json, notFound } from "@/lib/http";
import { adminRoute, audit } from "@/lib/admin";
import { CRON_JOBS, runCron, type CronJob } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** "Run now" on /admin/system: runs the same job logic as the scheduled cron, server-side. */
export const POST = adminRoute<{ name: string }>(async (_req, { name }, admin) => {
  if (!(CRON_JOBS as readonly string[]).includes(name)) throw notFound("Unknown job");
  const job = name as CronJob;
  try {
    const summary = await runCron(job, "admin");
    await audit(admin, "cron.run", "cron", job, { ok: true, summary });
    return json({ ok: true, summary });
  } catch (e) {
    await audit(admin, "cron.run", "cron", job, { ok: false, error: String((e as Error)?.message ?? e).slice(0, 300) }).catch(() => {});
    throw e;
  }
});
