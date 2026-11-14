import { File, Paths } from "expo-file-system";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { Platform } from "react-native";

import { ApiError } from "@/api/client";
import type { MediaItem } from "@/api/types";
import { DEMO_MODE } from "@/config";

export class PermissionDeniedError extends Error {
  constructor() {
    super("permission_denied");
    this.name = "PermissionDeniedError";
  }
}

/** The server refused the download (HTTP 402, e.g. `payment_required` before the event is paid): neutral message, no purchase prompt. */
export class DownloadLockedError extends Error {
  constructor() {
    super("download_locked");
    this.name = "DownloadLockedError";
  }
}

function extFor(item: MediaItem, url: string): string {
  const fromUrl = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (fromUrl && /^(jpe?g|png|heic|heif|webp|mp4|mov|m4v)$/.test(fromUrl)) return fromUrl;
  return item.kind === "video" ? "mp4" : "jpg";
}

/**
 * Downloads each ORIGINAL and adds it to the camera roll. Lists never carry originals (`originalUrl` is null), so
 * `urlFor` asks the download endpoint for a signed link per item (hosts: /occasions/:id/media/:mediaId/download;
 * guests: their own uploads via /g/:slug/media/:mediaId/download). Returns how many were saved.
 */
export async function saveToCameraRoll(list: MediaItem[], urlFor: (item: MediaItem) => Promise<string>): Promise<number> {
  if (DEMO_MODE || Platform.OS === "web") return list.length;
  const perm = await requestPermissionsAsync(true, ["photo", "video"]);
  if (!perm.granted) throw new PermissionDeniedError();
  let saved = 0;
  for (const item of list) {
    if (item.kind === "voice") continue;
    let url: string;
    try {
      url = await urlFor(item);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) throw new DownloadLockedError();
      continue;
    }
    const dest = new File(Paths.cache, `bizimresimler-${item.id}.${extFor(item, url)}`);
    try {
      const file = await File.downloadFileAsync(url, dest, { idempotent: true });
      await Asset.create(file.uri);
      saved++;
      try {
        file.delete();
      } catch {
        // ignore
      }
    } catch (e) {
      if (/\b402\b|payment_required|purchase_required/i.test(String((e as Error)?.message ?? e))) throw new DownloadLockedError();
      // keep going with the rest
    }
  }
  return saved;
}
