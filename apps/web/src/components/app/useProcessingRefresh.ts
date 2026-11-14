"use client";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { MediaItem } from "@/lib/api-types";

/**
 * While any listed item is still "processing" (server-side previews / watermarks / video transcodes), re-reads the first
 * page every few seconds and swaps in the updated items, so tiles turn into photos without a reload.
 * Stops on its own once nothing is pending (and after ~10 minutes; the cron sweep may take longer).
 */
export function useProcessingRefresh(
  items: MediaItem[] | null,
  fetchFirstPage: () => Promise<MediaItem[]>,
  setItems: Dispatch<SetStateAction<MediaItem[]>> | Dispatch<SetStateAction<MediaItem[] | null>>,
  everyMs = 8000,
) {
  const pending = !!items?.some((i) => i.processing === "pending" && (!i.thumbUrl || (i.kind === "video" && !i.playbackUrl)));
  const tries = useRef(0);
  const fetchRef = useRef(fetchFirstPage);
  fetchRef.current = fetchFirstPage;
  useEffect(() => {
    if (!pending) { tries.current = 0; return; }
    const id = setInterval(async () => {
      if (document.hidden || tries.current++ > 75) return;
      try {
        const fresh = new Map((await fetchRef.current()).map((i) => [i.id, i]));
        (setItems as Dispatch<SetStateAction<MediaItem[] | null>>)((prev) => prev?.map((p) => fresh.get(p.id) ?? p) ?? prev);
      } catch { /* next tick retries */ }
    }, everyMs);
    return () => clearInterval(id);
  }, [pending, setItems, everyMs]);
}
