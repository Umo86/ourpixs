import { defineConfig } from "@playwright/test";

/**
 * E2E config (run through `npm run test:e2e`, which starts the isolated services first: test/run.mjs).
 * Two mobile viewports, Chromium (the sandbox's /opt/pw-browsers build), one worker: the specs share one fake clock.
 * ourpixs.com resolves to 127.0.0.1 so the Our Pixs brand can be checked without DNS.
 */
const mobile = { isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 15 * 60_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  outputDir: "../test-results",
  use: {
    baseURL: `http://localhost:${process.env.E2E_APP_PORT || 3100}`,
    browserName: "chromium",
    launchOptions: { args: ["--host-resolver-rules=MAP ourpixs.com 127.0.0.1"] },
    acceptDownloads: true,
    trace: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "iphone14",
      use: { ...mobile, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
    },
    {
      name: "pixel7",
      use: { ...mobile, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625,
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" },
    },
  ],
});
