"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicOccasion } from "@/lib/api-types";
import { Uploader } from "@/lib/client/uploader";

export type GuestCtx = {
  slug: string;
  /** Base path as typed (vanity or random), e.g. /g/elif-and-can */
  path: string;
  occasion: PublicOccasion;
  guest: { id: string; displayName: string; shotsTaken: number } | null;
  pinOk: boolean;
};
type Full = GuestCtx & { uploader: Uploader; lockedDayId: string | null; api: (p: string) => string };

const Ctx = createContext<Full | null>(null);
export const uploadCountKey = (slug: string) => `op_up_${slug}`;
export const UPLOAD_COUNT_EVENT = "op-upload-count";
const uploaders = new Map<string, Uploader>();

export function GuestProvider({ value, children }: { value: GuestCtx; children: ReactNode }) {
  const [lockedDayId, setLocked] = useState<string | null>(null);
  const uploader = useMemo(() => {
    let u = uploaders.get(value.slug);
    if (!u) {
      u = new Uploader({ ns: `guest:${value.slug}`, createUrl: `/api/v1/g/${value.slug}/uploads`, completeUrl: `/api/v1/g/${value.slug}/uploads/complete`, maxVideoSeconds: value.occasion.videoMaxSeconds });
      uploaders.set(value.slug, u);
    }
    return u;
  }, [value.slug, value.occasion.videoMaxSeconds]);

  // Per-day QR links (?d=<dayId>) lock the guest to that day; remembered on this device.
  useEffect(() => {
    const key = `op_d_${value.slug}`;
    const fromUrl = new URLSearchParams(window.location.search).get("d");
    const valid = (id: string | null) => !!id && value.occasion.days.some((d) => d.id === id);
    if (valid(fromUrl)) {
      localStorage.setItem(key, fromUrl!);
      setLocked(fromUrl);
    } else {
      const saved = localStorage.getItem(key);
      setLocked(valid(saved) ? saved : null);
    }
  }, [value.slug, value.occasion.days]);

  useEffect(() => {
    if (value.guest) void uploader.restore();
  }, [uploader, value.guest]);

  // Successful uploads on this device (any screen), for the "email me the photos" card after the 3rd one.
  useEffect(() => uploader.onDone(() => {
    try {
      const key = uploadCountKey(value.slug);
      localStorage.setItem(key, String(Number(localStorage.getItem(key) || 0) + 1));
      window.dispatchEvent(new Event(UPLOAD_COUNT_EVENT));
    } catch { /* private mode */ }
  }), [uploader, value.slug]);

  const full = useMemo<Full>(() => ({ ...value, uploader, lockedDayId, api: (p: string) => `/api/v1/g/${value.slug}${p}` }), [value, uploader, lockedDayId]);
  return <Ctx.Provider value={full}>{children}</Ctx.Provider>;
}

export function useGuest() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGuest outside GuestProvider");
  return v;
}
