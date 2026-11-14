/**
 * Paywall check: builds real serializer output (src/lib/serializers.ts → toMediaItems) for every audience with fixtures,
 * plus the pure guest-download rules, and asserts the media paywall. No database, no network: storage is a fake R2
 * account, so links are signed locally and we can read which object each URL points at.
 *
 *   npx tsx --conditions=react-server --require ./scripts/server-only-shim.cjs scripts/paywall-check.ts
 *
 * Asserts:
 *  1. No ORIGINAL key/URL in any feed payload (guest, share, wall; host except the documented HEIC fallback) and
 *     `originalUrl` is null everywhere.
 *  2. Guests (and share links) get only WATERMARKED copies of other people's media; nothing while processing.
 *  3. Guests get CLEAN copies only of their own media, unless this device bought "download everything" (then clean
 *     copies of everything; the buyer's emailed /d page too). Hosts and the wall get clean copies.
 *  4. Guests can't download others' originals without an active paid purchase (refunded / expired / pending fail),
 *     and only permission-checked modules can mint links to originals.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

Object.assign(process.env, {
  R2_ACCOUNT_ID: "test0000000000000000000000000000", R2_ACCESS_KEY_ID: "AKIATEST", R2_SECRET_ACCESS_KEY: "secret-test", R2_BUCKET: "paywall-check",
  BLOB_READ_WRITE_TOKEN: "",
});

type Row = Parameters<typeof import("../src/lib/serializers").toMediaItems>[0][number];

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passes++;
  else { failures++; console.log(`FAIL  ${name}${detail ? `  (${detail})` : ""}`); }
}

const OCC = "11111111-1111-4111-8111-111111111111";
const ME = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
let n = 0;
function media(p: { kind: "photo" | "video"; guestId: string | null; status: "pending" | "ready" | "failed"; display?: boolean; thumb?: boolean }): Row {
  const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(++n).padStart(12, "0")}`;
  const dir = `o/${OCC}/${id}`;
  const ready = p.status === "ready";
  const m = {
    id, occasionId: OCC, dayId: null, guestId: p.guestId, uploadedByHostId: p.guestId ? null : "host", missionId: null, kind: p.kind,
    keyOriginal: `${dir}/original.${p.kind === "video" ? "mov" : "heic"}`,
    keyDisplay: p.display === false ? null : `${dir}/display.webp`, keyThumb: p.thumb === false ? null : `${dir}/thumb.webp`,
    keyGuest: ready ? `${dir}/guest.webp` : null, keyGuestThumb: ready ? `${dir}/guest-thumb.webp` : null,
    keyVideo: ready && p.kind === "video" ? `${dir}/video.mp4` : null, keyGuestVideo: ready && p.kind === "video" ? `${dir}/guest-video.mp4` : null,
    processingStatus: p.status, processedAt: ready ? new Date() : null, processingError: null, processingAttempts: 1, processingStartedAt: null,
    mime: p.kind === "video" ? "video/quicktime" : "image/heic", bytes: 1000, width: 100, height: 100, durationS: p.kind === "video" ? 10 : null,
    momentTag: null, fromDisposable: false, status: "uploaded", visibility: "visible", approved: true, favourite: false, reactionCount: 0,
    phash: null, blurScore: null, moderationFlags: [], createdAt: new Date(),
  } as Row["media"];
  return { media: m, guestName: p.guestId ? "Guest" : null, reactedByMe: false };
}

// Fixtures: own / other guest / host uploads, photos and videos, ready / pending / failed, and a photo with no display (HEIC).
const fixtures = {
  mineReady: media({ kind: "photo", guestId: ME, status: "ready" }),
  minePending: media({ kind: "photo", guestId: ME, status: "pending" }),
  mineVideoReady: media({ kind: "video", guestId: ME, status: "ready" }),
  mineVideoPending: media({ kind: "video", guestId: ME, status: "pending" }),
  otherReady: media({ kind: "photo", guestId: OTHER, status: "ready" }),
  otherPending: media({ kind: "photo", guestId: OTHER, status: "pending" }),
  otherFailed: media({ kind: "photo", guestId: OTHER, status: "failed", display: false, thumb: false }),
  otherVideoReady: media({ kind: "video", guestId: OTHER, status: "ready" }),
  otherVideoPending: media({ kind: "video", guestId: OTHER, status: "pending" }),
  hostReady: media({ kind: "photo", guestId: null, status: "ready" }),
  hostHeicFailed: media({ kind: "photo", guestId: null, status: "failed", display: false, thumb: false }),
};
const rows = Object.values(fixtures);
const nameOf = new Map(Object.entries(fixtures).map(([k, v]) => [v.media.id, k]));

/** The object key a signed URL points at (R2 path-style or virtual-host URL). */
function keyOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = new URL(url);
  return decodeURIComponent(u.pathname.replace(/^\/paywall-check\//, "/").slice(1));
}
const isOriginal = (k: string | null) => !!k && /\/original\.[a-z0-9]+$/.test(k);
const isWatermarked = (k: string | null) => !!k && /\/guest(-thumb|-video)?\.(webp|mp4)$/.test(k);
const isClean = (k: string | null) => !!k && /\/(display|thumb)\.webp$|\/video\.mp4$/.test(k);

async function main() {
  const { toMediaItems } = await import("../src/lib/serializers");
  const { guestMayDownloadOriginal, guestPurchaseOffered, guestSeesClean, purchaseActive } = await import("../src/lib/purchase-rules");

  const audiences = {
    guest: await toMediaItems(rows, { kind: "guest", guestId: ME }),
    // `purchased: false` explicitly (an expired / refunded / pending purchase resolves to false): still watermarked.
    guestUnpaid: await toMediaItems(rows, { kind: "guest", guestId: ME, purchased: false }),
    // A visitor who hasn't joined can never be "purchased" (no device to tie it to).
    visitorPaidFlag: await toMediaItems(rows, { kind: "guest", guestId: null, purchased: true }),
    paidGuest: await toMediaItems(rows, { kind: "guest", guestId: ME, purchased: true }),
    buyer: await toMediaItems(rows, { kind: "buyer" }),
    visitor: await toMediaItems(rows, { kind: "guest", guestId: null }),
    share: await toMediaItems(rows, { kind: "share" }),
    wall: await toMediaItems(rows, { kind: "wall" }),
    host: await toMediaItems(rows, { kind: "host" }),
  };

  console.log("audience  item               thumb               display             playback");
  for (const [aud, items] of Object.entries(audiences)) {
    for (const it of items) {
      const name = nameOf.get(it.id)!;
      const keys = [keyOf(it.thumbUrl), keyOf(it.displayUrl), keyOf(it.playbackUrl)];
      const short = (k: string | null) => (k ? k.split("/").pop()! : "-").padEnd(19);
      console.log(`${aud.padEnd(9)} ${name.padEnd(18)} ${keys.map(short).join(" ")}`);

      // 1. originals never in payloads; originalUrl null.
      check(`${aud}/${name}: originalUrl is null`, it.originalUrl === null, String(it.originalUrl));
      // Documented exception: hosts see the original of a photo that has no display copy at all (undecodable HEIC).
      const row = rows.find((r) => r.media.id === it.id)!.media;
      const hostFallback = aud === "host" && row.kind === "photo" && !row.keyDisplay;
      for (const k of keys) {
        if (isOriginal(k)) check(`${aud}/${name}: no original key in payload`, hostFallback, k!);
      }
      const own = name.startsWith("mine");
      if (aud === "paidGuest" || aud === "buyer") {
        // 5. paying guest (this device) and the buyer's link: clean copies of everything, never an original.
        check(`${aud}/${name}: clean copies only`, keys.every((k) => !k || isClean(k)), keys.join(","));
        check(`${aud}/${name}: no original`, keys.every((k) => !isOriginal(k)), keys.join(","));
        if (it.kind === "video" && row.processingStatus === "ready") check(`${aud}/${name}: clean 1080p playback`, /\/video\.mp4$/.test(keys[2] ?? ""), String(keys[2]));
        if (row.processingStatus === "ready") check(`${aud}/${name}: clean preview present`, isClean(keys[0]) && isClean(keys[1]), keys.join(","));
        continue;
      }
      if (aud === "guest" || aud === "guestUnpaid" || aud === "visitor" || aud === "visitorPaidFlag" || aud === "share") {
        if (own && (aud === "guest" || aud === "guestUnpaid")) {
          // 3. own uploads → clean copies only (or nothing yet).
          check(`${aud}/${name}: own media is clean`, keys.every((k) => !k || isClean(k)), keys.join(","));
          check(`${aud}/${name}: marked mine`, it.mine === true);
        } else {
          // 2. everyone else's → watermarked only, nothing while processing / failed.
          check(`${aud}/${name}: others' media watermarked only`, keys.every((k) => !k || isWatermarked(k)), keys.join(","));
          const ready = rows.find((r) => r.media.id === it.id)!.media.processingStatus === "ready";
          if (!ready) check(`${aud}/${name}: no URL until processed`, keys.every((k) => !k), keys.join(","));
          if (ready) check(`${aud}/${name}: watermarked preview present`, isWatermarked(keys[0]) && isWatermarked(keys[1]), keys.join(","));
          if (ready && it.kind === "video") check(`${aud}/${name}: watermarked 720p video`, /guest-video\.mp4$/.test(keys[2] ?? ""), String(keys[2]));
          if (aud !== "guest" && aud !== "guestUnpaid") check(`${aud}/${name}: not mine`, !it.mine);
        }
      } else {
        // host and wall → clean copies.
        check(`${aud}/${name}: clean copies`, keys.every((k) => !k || isClean(k) || (hostFallback && isOriginal(k))), keys.join(","));
        check(`${aud}/${name}: never watermarked`, keys.every((k) => !isWatermarked(k)), keys.join(","));
        if (it.kind === "video" && rows.find((r) => r.media.id === it.id)!.media.processingStatus === "ready") {
          check(`${aud}/${name}: clean 1080p playback`, /\/video\.mp4$/.test(keys[2] ?? ""), String(keys[2]));
        }
        if (aud === "wall") check(`wall/${name}: wall never shows originals`, keys.every((k) => !isOriginal(k)));
      }
      // Pending videos never play anything.
      if (it.kind === "video" && rows.find((r) => r.media.id === it.id)!.media.processingStatus !== "ready") {
        check(`${aud}/${name}: pending video has no playback`, !it.playbackUrl);
      }
    }
  }

  // 4. Guest downloads of originals.
  const now = new Date("2027-06-12T12:00:00Z");
  const live = { guestsCanView: true, canDownload: true };
  const later = new Date(now.getTime() + 86400_000);
  const earlier = new Date(now.getTime() - 1000);
  const cases: { name: string; ok: boolean; expect: boolean }[] = [
    { name: "own media, no purchase", ok: guestMayDownloadOriginal({ mediaGuestId: ME, viewerGuestId: ME, purchase: null, event: live, now }), expect: true },
    { name: "other's media, no purchase", ok: guestMayDownloadOriginal({ mediaGuestId: OTHER, viewerGuestId: ME, purchase: null, event: live, now }), expect: false },
    { name: "host's media, no purchase", ok: guestMayDownloadOriginal({ mediaGuestId: null, viewerGuestId: ME, purchase: null, event: live, now }), expect: false },
    { name: "visitor (no guest) and null uploader", ok: guestMayDownloadOriginal({ mediaGuestId: null, viewerGuestId: null, purchase: null, event: live, now }), expect: false },
    { name: "other's media, pending purchase", ok: guestMayDownloadOriginal({ mediaGuestId: OTHER, viewerGuestId: ME, purchase: { status: "pending", tokenExpiresAt: later }, event: live, now }), expect: false },
    { name: "other's media, refunded purchase", ok: guestMayDownloadOriginal({ mediaGuestId: OTHER, viewerGuestId: ME, purchase: { status: "refunded", tokenExpiresAt: later }, event: live, now }), expect: false },
    { name: "other's media, expired purchase", ok: guestMayDownloadOriginal({ mediaGuestId: OTHER, viewerGuestId: ME, purchase: { status: "paid", tokenExpiresAt: earlier }, event: live, now }), expect: false },
    { name: "other's media, paid purchase", ok: guestMayDownloadOriginal({ mediaGuestId: OTHER, viewerGuestId: ME, purchase: { status: "paid", tokenExpiresAt: later }, event: live, now }), expect: true },
    { name: "paid purchase but event downloads closed (expired/refunded/suspended)", ok: guestMayDownloadOriginal({ mediaGuestId: OTHER, viewerGuestId: ME, purchase: { status: "paid", tokenExpiresAt: later }, event: { guestsCanView: false, canDownload: false }, now }), expect: false },
    { name: "purchaseActive(paid, future)", ok: purchaseActive({ status: "paid", tokenExpiresAt: later }, now), expect: true },
    { name: "purchaseActive(paid, no expiry)", ok: purchaseActive({ status: "paid", tokenExpiresAt: null }, now), expect: false },
    { name: "clean previews: paid purchase, downloads open", ok: guestSeesClean({ status: "paid", tokenExpiresAt: later }, live, now), expect: true },
    { name: "clean previews: no purchase", ok: guestSeesClean(null, live, now), expect: false },
    { name: "clean previews: pending purchase", ok: guestSeesClean({ status: "pending", tokenExpiresAt: later }, live, now), expect: false },
    { name: "clean previews: refunded purchase", ok: guestSeesClean({ status: "refunded", tokenExpiresAt: later }, live, now), expect: false },
    { name: "clean previews: purchase past 30 days", ok: guestSeesClean({ status: "paid", tokenExpiresAt: earlier }, live, now), expect: false },
    { name: "clean previews: event downloads closed", ok: guestSeesClean({ status: "paid", tokenExpiresAt: later }, { guestsCanView: true, canDownload: false }, now), expect: false },
    { name: "offer: unpaid event", ok: guestPurchaseOffered({ paid: false, guestsCanView: false, canDownload: false }), expect: false },
    { name: "offer: paid + live", ok: guestPurchaseOffered({ paid: true, guestsCanView: true, canDownload: true }), expect: true },
    { name: "offer: paid but not open yet", ok: guestPurchaseOffered({ paid: true, guestsCanView: false, canDownload: true }), expect: false },
  ];
  for (const c of cases) check(`guest download: ${c.name}`, c.ok === c.expect, `got ${c.ok}`);

  // Static: only permission-checked modules can mint links to originals, and nothing else signs keyOriginal.
  const src = path.join(__dirname, "..", "src");
  const files: string[] = [];
  const walk = (d: string) => readdirSync(d).forEach((f) => { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f)) files.push(p); });
  walk(src);
  const ALLOWED = new Set([
    "lib/storage.ts", // defines it
    "lib/guest-purchase.ts", // purchaseManifest / purchasableOriginalUrl / guestOriginalUrl: after the purchase or own-media check
    "lib/admin-queries.ts", // admin moderation viewing (requireAdmin pages only)
    "lib/serializers.ts", // host album only: a photo with no display copy (undecodable HEIC), see media-urls.ts
    "app/api/v1/occasions/[id]/download/route.ts", // requireMember + assertCanDownload
    "app/api/v1/occasions/[id]/media/[mediaId]/download/route.ts", // requireMember + assertCanDownload
  ]);
  for (const f of files) {
    const rel = path.relative(src, f).split(path.sep).join("/");
    const text = readFileSync(f, "utf8");
    if (/privateGetUrl\(/.test(text)) check(`only allowed modules mint original links: ${rel}`, ALLOWED.has(rel));
    if (rel !== "lib/storage.ts" && /(presignGet|signMany)\([^)]*keyOriginal/.test(text)) check(`no compressed-copy signer is given an original: ${rel}`, false);
  }
  for (const rel of ["app/api/v1/occasions/[id]/download/route.ts", "app/api/v1/occasions/[id]/media/[mediaId]/download/route.ts"]) {
    const text = readFileSync(path.join(src, rel), "utf8");
    check(`${rel}: requires host membership and a downloadable (paid) event`, /requireMember\(/.test(text) && /assertCanDownload\(/.test(text));
  }
  const gp = readFileSync(path.join(src, "app/api/v1/g/[slug]/purchase/files/route.ts"), "utf8");
  check("guest manifest requires an active purchase", /activePurchase\(/.test(gp) && /purchase_required/.test(gp));
  // Clean previews for guests only through guestSeesClean (feed) or after the purchase check (download pages).
  for (const f of files) {
    const rel = path.relative(src, f).split(path.sep).join("/");
    const text = readFileSync(f, "utf8");
    if (/purchased:\s*true/.test(text)) check(`purchased: true only on the paid download page: ${rel}`, rel === "app/g/[slug]/download/page.tsx");
    if (/kind:\s*"buyer"/.test(text) && rel !== "lib/media-urls.ts") check(`buyer audience only on the /d page: ${rel}`, rel === "app/d/[token]/page.tsx");
  }
  const feed = readFileSync(path.join(src, "app/api/v1/g/[slug]/feed/route.ts"), "utf8");
  check("guest feed decides clean previews with guestSeesClean", /guestSeesClean\(/.test(feed) && /activePurchase\(/.test(feed));

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
