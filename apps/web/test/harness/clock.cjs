/**
 * TEST ONLY fake clock, preloaded with `node --require` into the Next server, the fake Stripe and the storage server
 * (never part of the app bundle). It shifts `Date` (new Date(), Date.now()) by an offset read from TEST_CLOCK_FILE
 * (milliseconds, written by the e2e tests through test/harness/clock.ts, polled every 50 ms). PostgreSQL's now() is
 * shifted by the same offset (public.now() reads testing.clock, see test/harness/db.mjs), so the access rules, crons,
 * signatures and expiries all see one consistent "now". Timers (setTimeout, performance.now) are not affected.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS preload (node --require)
const fs = require("node:fs");
const file = process.env.TEST_CLOCK_FILE;
if (file) {
  const RealDate = Date;
  let offset = 0;
  const read = () => {
    try {
      const n = Number(fs.readFileSync(file, "utf8").trim());
      offset = Number.isFinite(n) ? n : 0;
    } catch {
      offset = 0;
    }
  };
  read();
  fs.watchFile(file, { interval: 50, persistent: false }, read);
  const now = () => RealDate.now() + offset;
  const FakeDate = new Proxy(RealDate, {
    construct(target, args, newTarget) {
      if (args.length === 0) return Reflect.construct(target, [now()], newTarget);
      return Reflect.construct(target, args, newTarget);
    },
    apply() {
      return new RealDate(now()).toString();
    },
    get(target, prop, receiver) {
      if (prop === "now") return now;
      return Reflect.get(target, prop, receiver);
    },
  });
  globalThis.Date = FakeDate;
}
