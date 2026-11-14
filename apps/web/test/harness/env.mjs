/** TEST ONLY: one place for the e2e environment (ports, secrets, folders). Imported by run.mjs and the specs. */
import { join } from "node:path";

export const WORK = process.env.E2E_WORK || "/tmp/br-e2e";
export const APP_PORT = Number(process.env.E2E_APP_PORT || 3100);
export const STORAGE_PORT = Number(process.env.E2E_STORAGE_PORT || 4580);
export const STRIPE_PORT = Number(process.env.E2E_STRIPE_PORT || 12111);
export const PG_PORT = Number(process.env.E2E_PG_PORT || 54329);
export const BASE = `http://localhost:${APP_PORT}`;
/** Our Pixs (English alias) through Chromium's --host-resolver-rules (ourpixs.com → 127.0.0.1). */
export const BASE_OURPIXS = `http://ourpixs.com:${APP_PORT}`;
export const DB_URL = process.env.TEST_DATABASE_URL || `postgres://postgres@127.0.0.1:${PG_PORT}/bizimresimler_test`;
export const ADMIN_EMAIL = "admin@e2e.test";

export const paths = {
  storage: join(WORK, "storage"),
  emails: join(WORK, "emails"),
  clock: join(WORK, "clock-offset-ms"),
  serverLog: join(WORK, "server.log"),
  shots: process.env.E2E_SHOTS || "/tmp/e2e-shots",
  downloads: join(WORK, "downloads"),
};

export const secrets = {
  CRON_SECRET: "e2e-cron-secret-0123456789",
  STRIPE_WEBHOOK_SECRET: "whsec_e2e_0123456789abcdef",
  LOCAL_STORAGE_SECRET: "e2e-storage-secret-0123456789",
};

/** The environment of `next build` / `next start` in test mode. */
export function appEnv() {
  return {
    NODE_ENV: "production",
    // Like Vercel: the server renders in UTC while the phones are in London / Istanbul (catches zone-dependent hydration).
    TZ: "UTC",
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
    TEST_DB: "postgres",
    TEST_DATABASE_URL: DB_URL,
    DATABASE_URL: DB_URL,
    AUTH_SECRET: "e2e-auth-secret-0123456789abcdef",
    GUEST_TOKEN_SECRET: "e2e-guest-secret-0123456789abcdef",
    UNSUBSCRIBE_SECRET: "e2e-unsubscribe-secret-0123456789",
    CRON_SECRET: secrets.CRON_SECRET,
    DEFAULT_BRAND: "bizimresimler",
    NEXT_PUBLIC_URL_TR: BASE,
    NEXT_PUBLIC_URL_EN: BASE_OURPIXS,
    ADMIN_EMAILS: ADMIN_EMAIL,
    PREVIEW_SHOW_CODE: "1",
    EMAIL_CAPTURE_DIR: paths.emails,
    STORAGE_DRIVER: "local",
    LOCAL_STORAGE_DIR: paths.storage,
    LOCAL_STORAGE_URL: `http://127.0.0.1:${STORAGE_PORT}`,
    LOCAL_STORAGE_SECRET: secrets.LOCAL_STORAGE_SECRET,
    STRIPE_FAKE: "1",
    STRIPE_FAKE_URL: `http://127.0.0.1:${STRIPE_PORT}`,
    STRIPE_SECRET_KEY: "sk_test_e2e_fake",
    STRIPE_WEBHOOK_SECRET: secrets.STRIPE_WEBHOOK_SECRET,
    INTERNAL_BASE_URL: BASE,
    TEST_CLOCK_FILE: paths.clock,
  };
}
