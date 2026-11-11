import "server-only";
import {
  S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectsCommand,
  CreateMultipartUploadCommand, UploadPartCommand, ListMultipartUploadsCommand, ListPartsCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand, type CompletedPart,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { head as blobHead, del as blobDel, BlobNotFoundError } from "@vercel/blob";
import { ApiError } from "./http";
import { randomToken } from "./crypto";

/**
 * Media storage behind one interface. Driver is picked from env:
 *   R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET → Cloudflare R2 (S3 API, private bucket, presigned URLs)
 *   BLOB_READ_WRITE_TOKEN                                               → Vercel Blob
 *   neither                                                             → StorageNotConfigured
 * Browsers/apps always upload directly to storage with a presigned PUT; bytes never pass through a Vercel function.
 */

export type Driver = "r2" | "blob";
export type PresignedPut = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  /** R2 only, originals > 50 MB: PUT each part (10 MB slices, in order) instead of `url`. The server completes the upload. */
  multipart?: { partSize: number; parts: { partNumber: number; url: string }[] };
};

export class StorageNotConfigured extends ApiError {
  constructor() {
    super(503, "storage_not_configured", "Photo storage isn't set up yet. Please try again later.");
  }
}

const URL_TTL = 3600;
const MULTIPART_THRESHOLD = 50 * 1024 * 1024;
const PART_SIZE = 10 * 1024 * 1024;

export function storageDriver(): Driver | null {
  const e = process.env;
  if (e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET) return "r2";
  if (e.BLOB_READ_WRITE_TOKEN) return "blob";
  return null;
}

function driver(): Driver {
  const d = storageDriver();
  if (!d) throw new StorageNotConfigured();
  return d;
}

let s3: S3Client | null = null;
function r2() {
  s3 ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  return s3;
}
const bucket = () => process.env.R2_BUCKET!;

/*
 * Vercel Blob has no private reads, so blobs are stored with `access: "public"` but under unguessable
 * pathnames: every file (original, display, thumb) gets its own random 128-bit segment, so knowing one
 * URL (e.g. a thumbnail a guest saw) never reveals the original or another file. URLs are only ever
 * handed out by our permission-checked API; deletion removes the blob for real.
 */
const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN!;
const blobStoreId = () => blobToken().split("_")[3] || "";
const blobPublicUrl = (key: string) => `https://${blobStoreId()}.public.blob.vercel-storage.com/${key}`;
const BLOB_API = process.env.VERCEL_BLOB_API_URL || "https://vercel.com/api/blob";

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif", "image/webp": "webp",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
  "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/webm": "webm", "audio/mpeg": "mp3",
};

function fileName(base: string, ext: string) {
  return storageDriver() === "blob" ? `${base}-${randomToken(16)}.${ext}` : `${base}.${ext}`;
}

/** o/{occasionId}/{mediaId}/original.{ext}, display.webp, thumb.webp */
export function mediaKeys(occasionId: string, mediaId: string, mime: string) {
  const dir = `o/${occasionId}/${mediaId}`;
  return {
    original: `${dir}/${fileName("original", EXT_BY_MIME[mime] || "bin")}`,
    display: `${dir}/${fileName("display", "webp")}`,
    thumb: `${dir}/${fileName("thumb", "webp")}`,
  };
}

/** Guestbook voice/video notes: o/{occasionId}/msg/{guestId}/{random}.{ext} */
export function messageKey(occasionId: string, guestId: string, mime: string) {
  return `o/${occasionId}/msg/${guestId}/${randomToken(12)}.${EXT_BY_MIME[mime] || "bin"}`;
}

export async function presignPut(key: string, contentType: string, bytes?: number): Promise<PresignedPut> {
  const d = driver();
  if (d === "r2") {
    const url = await getSignedUrl(r2(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), { expiresIn: URL_TTL });
    const out: PresignedPut = { url, method: "PUT", headers: { "Content-Type": contentType } };
    if (bytes && bytes > MULTIPART_THRESHOLD) {
      const mpu = await r2().send(new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: contentType }));
      const count = Math.ceil(bytes / PART_SIZE);
      const parts = await Promise.all(Array.from({ length: count }, async (_, i) => ({
        partNumber: i + 1,
        url: await getSignedUrl(r2(), new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: mpu.UploadId!, PartNumber: i + 1 }), { expiresIn: URL_TTL * 6 }),
      })));
      out.multipart = { partSize: PART_SIZE, parts };
    }
    return out;
  }
  const clientToken = await generateClientTokenFromReadWriteToken({
    token: blobToken(),
    pathname: key,
    allowedContentTypes: [contentType],
    maximumSizeInBytes: bytes ? Math.ceil(bytes * 1.01) + 1024 : 25 * 1024 * 1024,
    validUntil: Date.now() + URL_TTL * 1000,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return {
    url: `${BLOB_API}/?pathname=${encodeURIComponent(key)}`,
    method: "PUT",
    headers: {
      authorization: `Bearer ${clientToken}`,
      "x-api-version": "13",
      "x-vercel-blob-access": "public",
      "x-vercel-blob-store-id": blobStoreId(),
      "x-content-type": contentType,
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "1",
    },
  };
}

/** Short-lived read URL (R2: presigned 1h; Blob: the unguessable public URL). */
export async function presignGet(key: string, opts: { download?: string } = {}): Promise<string> {
  const d = driver();
  if (d === "r2") {
    return getSignedUrl(r2(), new GetObjectCommand({
      Bucket: bucket(), Key: key,
      ResponseContentDisposition: opts.download ? `attachment; filename="${opts.download.replace(/[^\w.\- ]/g, "_")}"` : undefined,
    }), { expiresIn: URL_TTL });
  }
  return opts.download ? `${blobPublicUrl(key)}?download=1` : blobPublicUrl(key);
}

/** Signs many keys; missing storage config yields nulls instead of throwing (lists still render). */
export async function signMany(keys: (string | null | undefined)[]): Promise<(string | null)[]> {
  if (!storageDriver()) return keys.map(() => null);
  return Promise.all(keys.map((k) => (k ? presignGet(k) : Promise.resolve(null))));
}

export async function headObject(key: string): Promise<{ bytes: number } | null> {
  const d = driver();
  if (d === "r2") {
    try {
      const r = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return { bytes: Number(r.ContentLength ?? 0) };
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (e as Error).name === "NotFound") return null;
      throw e;
    }
  }
  try {
    const r = await blobHead(blobPublicUrl(key), { token: blobToken() });
    return { bytes: r.size };
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}

async function findMultipart(key: string): Promise<string | null> {
  const r = await r2().send(new ListMultipartUploadsCommand({ Bucket: bucket(), Prefix: key }));
  const u = (r.Uploads || []).filter((x) => x.Key === key).sort((a, b) => (b.Initiated?.getTime() ?? 0) - (a.Initiated?.getTime() ?? 0))[0];
  return u?.UploadId ?? null;
}

/**
 * Confirms an upload landed. For R2 multipart uploads the client never sees ETags: we list the parts
 * server-side and complete the upload here. Returns the object size, or null if nothing was uploaded.
 */
export async function finalizeUpload(key: string): Promise<{ bytes: number } | null> {
  const existing = await headObject(key);
  if (driver() !== "r2") return existing;
  const uploadId = await findMultipart(key);
  if (existing) {
    if (uploadId) await r2().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId })).catch(() => {});
    return existing;
  }
  if (!uploadId) return null;
  const parts: CompletedPart[] = [];
  let marker: string | undefined;
  do {
    const r = await r2().send(new ListPartsCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumberMarker: marker }));
    for (const p of r.Parts || []) parts.push({ ETag: p.ETag, PartNumber: p.PartNumber });
    marker = r.IsTruncated ? r.NextPartNumberMarker : undefined;
  } while (marker);
  if (!parts.length) return null;
  parts.sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));
  await r2().send(new CompleteMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts } }));
  return headObject(key);
}

export async function abortUpload(key: string) {
  if (storageDriver() !== "r2") return;
  const id = await findMultipart(key).catch(() => null);
  if (id) await r2().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: id })).catch(() => {});
}

export async function deleteObjects(keys: (string | null | undefined)[]) {
  const list = keys.filter((k): k is string => !!k);
  if (!list.length || !storageDriver()) return;
  if (driver() === "r2") {
    for (let i = 0; i < list.length; i += 1000) {
      await r2().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: list.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
    }
    return;
  }
  for (let i = 0; i < list.length; i += 500) {
    await blobDel(list.slice(i, i + 500).map(blobPublicUrl), { token: blobToken() });
  }
}
