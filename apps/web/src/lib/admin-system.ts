import "server-only";
import { storageDriver } from "./storage";
import { adminEmails } from "./admin";

/**
 * Read-only health for /admin/system: which integrations are configured. Never returns a secret value —
 * only whether it is set, plus a few non-secret facts (storage driver, Stripe test/live mode, counts).
 */
export type Check = { key: string; ok: boolean; required: boolean; detail?: string; warn?: boolean };

const set = (name: string, min = 1) => (process.env[name]?.trim().length ?? 0) >= min;

export function integrationChecks(): Check[] {
  const driver = storageDriver();
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const stripeMode = stripeKey.startsWith("sk_live_") || stripeKey.startsWith("rk_live_") ? "live" : stripeKey ? "test" : undefined;
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || "").split(",").map((s) => s.trim()).filter(Boolean).length;
  const preview = process.env.PREVIEW_SHOW_CODE === "1";
  return [
    { key: "database", ok: set("DATABASE_URL"), required: true },
    { key: "authSecret", ok: set("AUTH_SECRET", 16), required: true },
    { key: "guestSecret", ok: set("GUEST_TOKEN_SECRET", 16), required: true },
    { key: "storage", ok: !!driver, required: true, detail: driver ?? undefined },
    { key: "resend", ok: set("RESEND_API_KEY"), required: true },
    { key: "emailFrom", ok: set("EMAIL_FROM_EN") && set("EMAIL_FROM_TR"), required: false },
    { key: "stripe", ok: !!stripeKey, required: true, detail: stripeMode },
    { key: "stripeWebhook", ok: set("STRIPE_WEBHOOK_SECRET"), required: true },
    { key: "openai", ok: set("OPENAI_API_KEY"), required: false },
    { key: "expo", ok: set("EXPO_ACCESS_TOKEN"), required: false },
    { key: "appleTeam", ok: set("APPLE_TEAM_ID"), required: false },
    { key: "android", ok: fingerprints > 0, required: false, detail: fingerprints ? String(fingerprints) : undefined },
    { key: "cronSecret", ok: set("CRON_SECRET"), required: true },
    // "ok" here means the safe state (off). On = login codes may be shown on screen when email isn't configured.
    { key: "previewCode", ok: !preview, required: false, warn: preview },
    { key: "review", ok: set("REVIEW_EMAIL") && set("REVIEW_CODE"), required: false },
    { key: "admins", ok: adminEmails().size > 0, required: true, detail: String(adminEmails().size) },
  ];
}

export function publicUrls() {
  return {
    en: process.env.NEXT_PUBLIC_URL_EN || null,
    tr: process.env.NEXT_PUBLIC_URL_TR || null,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
  };
}
