#!/usr/bin/env node
// Validates store metadata lengths (App Store Connect + Google Play). Run: node store/check-metadata.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "fastlane", "metadata");
const LIMITS = {
  ios: { "name.txt": 30, "subtitle.txt": 30, "promotional_text.txt": 170, "description.txt": 4000, "keywords.txt": 100, "release_notes.txt": 4000 },
  android: { "title.txt": 30, "short_description.txt": 80, "full_description.txt": 4000, "changelogs/default.txt": 500 },
};
let failed = 0;
const len = (s) => [...s.replace(/\n$/, "")].length; // count code points, as the stores do
function check(dir, limits, label) {
  for (const [file, max] of Object.entries(limits)) {
    const p = join(dir, file);
    if (!existsSync(p)) { console.log(`MISSING ${label}/${file}`); failed++; continue; }
    const n = len(readFileSync(p, "utf8"));
    const ok = n <= max && n > 0;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${label}/${file}: ${n}/${max}`);
  }
}
for (const loc of readdirSync(root, { withFileTypes: true })) {
  if (!loc.isDirectory() || ["android", "review_information"].includes(loc.name)) continue;
  check(join(root, loc.name), LIMITS.ios, `ios/${loc.name}`);
  const kw = readFileSync(join(root, loc.name, "keywords.txt"), "utf8").trim();
  if (/,\s/.test(kw)) { console.log(`FAIL ios/${loc.name}/keywords.txt: remove spaces after commas`); failed++; }
}
for (const loc of readdirSync(join(root, "android"))) check(join(root, "android", loc), LIMITS.android, `android/${loc}`);
if (failed) { console.error(`\n${failed} problem(s)`); process.exit(1); }
console.log("\nAll metadata within limits.");
