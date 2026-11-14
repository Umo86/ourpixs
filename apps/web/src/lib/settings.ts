import "server-only";
import { cache } from "react";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { PACKAGE_DEFAULTS, type PackageSettings } from "./config";

/**
 * Admin-editable product settings (/admin/settings), stored as one row per key in `settings` (value jsonb).
 * Every getter falls back to PACKAGE_DEFAULTS in config.ts when a key is missing, malformed, or the table
 * can't be read (e.g. before migration 0007 is applied). Loaded once per request (React `cache`).
 */

export type SettingKey = keyof PackageSettings;
export const SETTING_KEYS = Object.keys(PACKAGE_DEFAULTS) as SettingKey[];

/** Allowed range per key (also the admin form's min/max). */
export const SETTING_RULES: Record<SettingKey, { min: number; max: number; step: number; unit: "pence" | "days" | "gb" | "seconds" | "months" | "items" }> = {
  eventPricePence: { min: 100, max: 100_000, step: 1, unit: "pence" },
  guestDownloadPence: { min: 100, max: 10_000, step: 1, unit: "pence" },
  windowDays: { min: 1, max: 31, step: 1, unit: "days" },
  fairUseGb: { min: 1, max: 2000, step: 1, unit: "gb" },
  videoMaxSeconds: { min: 10, max: 1800, step: 1, unit: "seconds" },
  retentionMonths: { min: 1, max: 60, step: 1, unit: "months" },
  hostTestUploadLimit: { min: 0, max: 500, step: 1, unit: "items" },
  unpaidDeleteDays: { min: 14, max: 730, step: 1, unit: "days" },
};

const valueSchema = (k: SettingKey) => z.number().int().min(SETTING_RULES[k].min).max(SETTING_RULES[k].max);

/** zod schema for an admin update: any subset of keys, each within its range. */
export const settingsPatchSchema = z.object(
  Object.fromEntries(SETTING_KEYS.map((k) => [k, valueSchema(k).optional()])) as Record<SettingKey, z.ZodOptional<z.ZodNumber>>,
).refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Change at least one setting" });

/** Stored values merged over the defaults. Invalid stored values are ignored (default wins). */
export function mergeSettings(rows: { key: string; value: unknown }[]): PackageSettings {
  const out: PackageSettings = { ...PACKAGE_DEFAULTS };
  for (const r of rows) {
    if (!(SETTING_KEYS as string[]).includes(r.key)) continue;
    const k = r.key as SettingKey;
    const parsed = valueSchema(k).safeParse(r.value);
    if (parsed.success) out[k] = parsed.data;
  }
  return out;
}

async function load(): Promise<PackageSettings> {
  try {
    const rows = await db.select({ key: schema.settings.key, value: schema.settings.value }).from(schema.settings)
      .where(inArray(schema.settings.key, SETTING_KEYS));
    return mergeSettings(rows);
  } catch (e) {
    console.error("[settings] could not load settings; using defaults", e);
    return { ...PACKAGE_DEFAULTS };
  }
}

/** All settings for this request (memoised per request in Server Components and route handlers). */
export const getSettings = cache(load);

/** Typed single-value getters. */
export const eventPricePence = async () => (await getSettings()).eventPricePence;
export const guestDownloadPence = async () => (await getSettings()).guestDownloadPence;
export const windowDays = async () => (await getSettings()).windowDays;
export const fairUseGb = async () => (await getSettings()).fairUseGb;
export const videoMaxSeconds = async () => (await getSettings()).videoMaxSeconds;
export const retentionMonths = async () => (await getSettings()).retentionMonths;
export const hostTestUploadLimit = async () => (await getSettings()).hostTestUploadLimit;
export const unpaidDeleteDays = async () => (await getSettings()).unpaidDeleteDays;

/** Stored rows with who changed them and when (admin page). */
export async function settingsRows() {
  return db.select().from(schema.settings).where(inArray(schema.settings.key, SETTING_KEYS));
}

/** Upserts the given keys (admin only; the caller validates with settingsPatchSchema and writes the audit row). */
export async function saveSettings(values: Partial<PackageSettings>, adminId: string) {
  const now = new Date();
  const entries = Object.entries(values).filter(([, v]) => v !== undefined) as [SettingKey, number][];
  for (const [key, value] of entries) {
    await db.insert(schema.settings).values({ key, value, updatedAt: now, updatedBy: adminId })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: now, updatedBy: adminId } });
  }
}
