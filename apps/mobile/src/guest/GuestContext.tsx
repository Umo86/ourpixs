import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, guestApi, type GuestAuth } from "@/api/client";
import type { PublicOccasion } from "@/api/types";
import { removeGuestSession, saveGuestSession, type GuestSession } from "@/lib/guestSessions";
import { storage } from "@/lib/storage";

type Ctx = {
  slug: string;
  session: GuestSession;
  auth: GuestAuth;
  occasion: PublicOccasion | null;
  error: unknown;
  refresh: () => Promise<void>;
  shotsUsed: number;
  consumeShot: () => void;
  leave: () => Promise<void>;
  /** True when the server rejected our guest token (removed guest / event deleted). */
  expired: boolean;
};

const GuestCtx = createContext<Ctx | null>(null);

export function GuestProvider({ session, children }: { session: GuestSession; children: ReactNode }) {
  const slug = session.slug;
  const auth = useMemo<GuestAuth>(() => ({ token: session.token, pin: session.pin ?? null }), [session.token, session.pin]);
  const [occasion, setOccasion] = useState<PublicOccasion | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [expired, setExpired] = useState(false);
  const [shotsUsed, setShotsUsed] = useState(0);
  const shotsKey = `op_shots_${slug}`;

  const refresh = useCallback(async () => {
    try {
      const res = await guestApi.occasion(slug, auth);
      setOccasion(res.occasion);
      setError(null);
      if (res.occasion.title !== session.title) void saveGuestSession({ ...session, title: res.occasion.title });
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && (e.status === 401 || e.status === 410)) setExpired(true);
    }
  }, [slug, auth, session]);

  useEffect(() => {
    void refresh();
    void storage.get(shotsKey).then((v) => setShotsUsed(v ? Number(v) || 0 : 0));
  }, [refresh, shotsKey]);

  const consumeShot = useCallback(() => {
    setShotsUsed((n) => {
      void storage.set(shotsKey, String(n + 1));
      return n + 1;
    });
  }, [shotsKey]);

  const leave = useCallback(async () => {
    await removeGuestSession(slug);
  }, [slug]);

  return (
    <GuestCtx.Provider value={{ slug, session, auth, occasion, error, refresh, shotsUsed, consumeShot, leave, expired }}>{children}</GuestCtx.Provider>
  );
}

export function useGuest(): Ctx {
  const c = useContext(GuestCtx);
  if (!c) throw new Error("useGuest must be used inside <GuestProvider>");
  return c;
}
