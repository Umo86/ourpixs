/**
 * Prepares a picked asset for upload: a 1600px display rendition and a 400px thumbnail (JPEG).
 * The original file is uploaded untouched.
 */
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { createVideoPlayer } from "expo-video";
import { Platform } from "react-native";

export const DISPLAY_EDGE = 1600;
export const THUMB_EDGE = 400;

export type Rendition = { uri: string; mime: string; bytes: number; width: number; height: number };

function fileSize(uri: string): number {
  try {
    const f = new File(uri);
    return f.size ?? 0;
  } catch {
    return 0;
  }
}

/** Resize an image (or a video frame ref) so its long edge is at most `edge`. */
async function renderJpeg(source: Parameters<typeof ImageManipulator.manipulate>[0], width: number, height: number, edge: number, compress: number): Promise<Rendition> {
  const landscape = width >= height;
  const ctx = ImageManipulator.manipulate(source, landscape ? { maxWidth: edge * 2 } : { maxHeight: edge * 2 });
  if (Math.max(width, height) > edge || width === 0 || height === 0) {
    ctx.resize(landscape ? { width: edge } : { height: edge });
  }
  const ref = await ctx.renderAsync();
  const res = await ref.saveAsync({ format: SaveFormat.JPEG, compress });
  ctx.release();
  ref.release();
  return { uri: res.uri, mime: "image/jpeg", bytes: fileSize(res.uri), width: res.width, height: res.height };
}

export async function preparePhoto(uri: string, width: number, height: number): Promise<{ display: Rendition | null; thumb: Rendition | null }> {
  if (Platform.OS === "web") return { display: null, thumb: null };
  let display: Rendition | null = null;
  let thumb: Rendition | null = null;
  try {
    display = await renderJpeg(uri, width, height, DISPLAY_EDGE, 0.82);
  } catch {
    display = null;
  }
  try {
    // Derive the thumb from the (smaller) display rendition when we have it.
    thumb = display
      ? await renderJpeg(display.uri, display.width, display.height, THUMB_EDGE, 0.75)
      : await renderJpeg(uri, width, height, THUMB_EDGE, 0.75);
  } catch {
    thumb = null;
  }
  return { display, thumb };
}

/** Grabs a frame ~0.5s in and turns it into a 400px JPEG thumbnail. Best effort. */
export async function prepareVideoThumb(uri: string): Promise<Rendition | null> {
  if (Platform.OS === "web") return null;
  const player = createVideoPlayer(uri);
  try {
    const [frame] = await player.generateThumbnailsAsync([0.5]);
    if (!frame) return null;
    const r = await renderJpeg(frame, frame.width, frame.height, THUMB_EDGE, 0.75);
    frame.release();
    return r;
  } catch {
    return null;
  } finally {
    player.release();
  }
}

export function sizeOf(uri: string): number {
  return fileSize(uri);
}
