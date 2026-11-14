import { z } from "zod";
import { json, readJson } from "@/lib/http";
import { adminRoute, audit, reasonSchema } from "@/lib/admin";
import { getSettings, saveSettings, settingsPatchSchema } from "@/lib/settings";

const body = z.object({ values: settingsPatchSchema, reason: reasonSchema });

/** PATCH { values: { eventPricePence?, windowDays?, … }, reason } — admin-editable product settings, audited with before/after. */
export const PATCH = adminRoute(async (req, _params, admin) => {
  const b = await readJson(req, body);
  const before = await getSettings();
  const changed = Object.fromEntries(Object.entries(b.values).filter(([k, v]) => v !== undefined && before[k as keyof typeof before] !== v));
  if (Object.keys(changed).length) await saveSettings(changed, admin.id);
  await audit(admin, "settings.update", "settings", null, {
    reason: b.reason,
    changes: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, { from: before[k as keyof typeof before], to: v }])),
  });
  return json({ ok: true });
});
