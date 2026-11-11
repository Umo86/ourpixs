import { File, Paths } from "expo-file-system";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { Platform } from "react-native";

import type { MediaItem } from "@/api/types";
import { DEMO_MODE } from "@/config";

export class PermissionDeniedError extends Error {
  constructor() {
    super("permission_denied");
    this.name = "PermissionDeniedError";
  }
}

function extFor(item: MediaItem, url: string): string {
  const fromUrl = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (fromUrl && /^(jpe?g|png|heic|heif|webp|mp4|mov|m4v)$/.test(fromUrl)) return fromUrl;
  return item.kind === "video" ? "mp4" : "jpg";
}

/** Downloads each item (original if available) and adds it to the camera roll. Returns how many were saved. */
export async function saveToCameraRoll(list: MediaItem[]): Promise<number> {
  if (DEMO_MODE || Platform.OS === "web") return list.length;
  const perm = await requestPermissionsAsync(true, ["photo", "video"]);
  if (!perm.granted) throw new PermissionDeniedError();
  let saved = 0;
  for (const item of list) {
    const url = item.originalUrl || item.displayUrl;
    if (!url || item.kind === "voice") continue;
    const dest = new File(Paths.cache, `ourpixs-${item.id}.${extFor(item, url)}`);
    try {
      const file = await File.downloadFileAsync(url, dest, { idempotent: true });
      await Asset.create(file.uri);
      saved++;
      try {
        file.delete();
      } catch {
        // ignore
      }
    } catch {
      // keep going with the rest
    }
  }
  return saved;
}
