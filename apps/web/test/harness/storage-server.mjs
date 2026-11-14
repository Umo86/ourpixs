/**
 * TEST ONLY: serves the `local` storage driver's files (src/lib/storage-local.ts) to browsers, the way R2 serves
 * presigned URLs: every request needs a valid HMAC signature (LOCAL_STORAGE_SECRET) for its method, key, content type
 * and download name, and an expiry in the future (fake clock aware: run with --require test/harness/clock.cjs).
 * GET supports Range (video playback); PUT checks the signed Content-Type. CORS is open like the R2 bucket's policy.
 * Anything else answers 403, exactly like a private bucket.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

const ROOT = resolve(process.env.LOCAL_STORAGE_DIR);
const SECRET = process.env.LOCAL_STORAGE_SECRET;
const PORT = Number(process.env.LOCAL_STORAGE_PORT || 4580);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "ETag, Content-Length, Content-Range",
  "Access-Control-Max-Age": "3600",
};

const sign = (m, key, exp, ct, dl) => createHmac("sha256", SECRET).update([m, key, exp, ct ?? "", dl ?? ""].join("\n")).digest("hex");
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function deny(res, status, msg) {
  res.writeHead(status, { ...CORS, "Content-Type": "text/plain" });
  res.end(msg);
}

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
    const u = new URL(req.url, "http://x");
    const key = u.pathname.slice(1).split("/").map(decodeURIComponent).join("/");
    const m = u.searchParams.get("m");
    const exp = u.searchParams.get("exp") || "";
    const ct = u.searchParams.get("ct") || undefined;
    const dl = u.searchParams.get("dl") || undefined;
    const sig = u.searchParams.get("sig") || "";
    const method = req.method === "HEAD" ? "GET" : req.method;
    if (!key || m !== method || !sig || !same(sig, sign(m, key, exp, ct, dl))) return deny(res, 403, "SignatureDoesNotMatch");
    if (!(Number(exp) * 1000 > Date.now())) return deny(res, 403, "Request has expired");
    const path = resolve(ROOT, key);
    if (!path.startsWith(ROOT + sep)) return deny(res, 403, "AccessDenied");

    if (method === "PUT") {
      const got = (req.headers["content-type"] || "").split(";")[0].trim();
      if (ct && got !== ct) return deny(res, 403, "Content-Type does not match the signature");
      mkdirSync(dirname(path), { recursive: true });
      await pipeline(req, createWriteStream(path));
      writeFileSync(`${path}.meta.json`, JSON.stringify({ contentType: got || ct || "application/octet-stream" }));
      res.writeHead(200, { ...CORS, ETag: `"${statSync(path).mtimeMs}"` });
      return res.end();
    }

    if (!existsSync(path) || !statSync(path).isFile()) return deny(res, 404, "NoSuchKey");
    const size = statSync(path).size;
    let type = "application/octet-stream";
    try { type = JSON.parse(readFileSync(`${path}.meta.json`, "utf8")).contentType || type; } catch { /* no meta */ }
    const headers = { ...CORS, "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
    if (dl) headers["Content-Disposition"] = `attachment; filename="${dl.replace(/[^\w.\- ]/g, "_")}"`;
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : size - 1;
      start = Math.max(0, start); end = Math.min(size - 1, end);
      if (start > end) { res.writeHead(416, { ...CORS, "Content-Range": `bytes */${size}` }); return res.end(); }
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
      if (req.method === "HEAD") return res.end();
      return void createReadStream(path, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, "Content-Length": size });
    if (req.method === "HEAD") return res.end();
    createReadStream(path).pipe(res);
  } catch (e) {
    console.error("[storage-server]", e);
    deny(res, 500, "InternalError");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`[storage-server] listening on ${PORT}, root ${ROOT}`));
