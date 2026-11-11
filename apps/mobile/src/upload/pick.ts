import * as ImagePicker from "expo-image-picker";

import type { PickedAsset } from "./queue";

/** Opens the system photo picker (multi-select). Returns [] if cancelled. */
export async function pickFromLibrary(opts: { allowVideo: boolean; limit?: number; maxVideoSeconds?: number }): Promise<PickedAsset[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: opts.allowVideo ? ["images", "videos"] : ["images"],
    allowsMultipleSelection: true,
    selectionLimit: opts.limit ?? 50,
    orderedSelection: true,
    quality: 1,
    exif: false,
    videoMaxDuration: opts.maxVideoSeconds || undefined,
  });
  if (res.canceled) return [];
  return res.assets.map(toPicked);
}

export function toPicked(a: ImagePicker.ImagePickerAsset): PickedAsset {
  const isVideo = a.type === "video" || a.type === "pairedVideo";
  return {
    uri: a.uri,
    kind: isVideo ? "video" : "photo",
    mime: a.mimeType ?? null,
    name: a.fileName ?? null,
    bytes: a.fileSize ?? null,
    width: a.width || undefined,
    height: a.height || undefined,
    durationS: a.duration ? Math.round(a.duration / 1000) : null,
  };
}
