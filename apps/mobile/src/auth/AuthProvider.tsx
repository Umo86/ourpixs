import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { authApi, onUnauthorized, setHostToken } from "@/api/client";
import type { Host, Subscription } from "@/api/types";
import { storage } from "@/lib/storage";

const TOKEN_KEY = "op_host_token";
const HOST_KEY = "op_host_profile";

type AuthCtx = {
  ready: boolean;
  token: string | null;
  host: Host | null;
  /** Account subscription from GET /me (null until loaded). */
  subscription: Subscription | null;
  /** Re-reads /me (profile + subscription). Call after creating an event: the trial starts then. */
  refreshMe: () => Promise<void>;
  signIn: (token: string, host: Host) => Promise<void>;
  signOut: () => Promise<void>;
  setHost: (h: Host) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [host, setHostState] = useState<Host | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const signOut = useCallback(async () => {
    setHostToken(null);
    setToken(null);
    setHostState(null);
    setSubscription(null);
    await Promise.all([storage.remove(TOKEN_KEY), storage.remove(HOST_KEY)]);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [t, h] = await Promise.all([storage.get(TOKEN_KEY), storage.getJSON<Host>(HOST_KEY)]);
      if (!alive) return;
      if (t) {
        setHostToken(t);
        setToken(t);
        setHostState(h);
        // Refresh the profile in the background; a 401 triggers sign-out via onUnauthorized.
        authApi
          .me()
          .then(({ host: fresh, subscription: sub }) => {
            if (!alive) return;
            setHostState(fresh);
            setSubscription(sub ?? null);
            void storage.setJSON(HOST_KEY, fresh);
          })
          .catch(() => undefined);
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    onUnauthorized(() => void signOut());
    return () => onUnauthorized(null);
  }, [signOut]);

  const signIn = useCallback(async (t: string, h: Host) => {
    setHostToken(t);
    setToken(t);
    setHostState(h);
    await Promise.all([storage.set(TOKEN_KEY, t), storage.setJSON(HOST_KEY, h)]);
    void authApi
      .me()
      .then(({ subscription: sub }) => setSubscription(sub ?? null))
      .catch(() => undefined);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { host: fresh, subscription: sub } = await authApi.me();
      setHostState(fresh);
      setSubscription(sub ?? null);
      void storage.setJSON(HOST_KEY, fresh);
    } catch {
      // keep what we have; a 401 signs out via onUnauthorized
    }
  }, []);

  const setHost = useCallback((h: Host) => {
    setHostState(h);
    void storage.setJSON(HOST_KEY, h);
  }, []);

  const value = useMemo(() => ({ ready, token, host, subscription, refreshMe, signIn, signOut, setHost }), [ready, token, host, subscription, refreshMe, signIn, signOut, setHost]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}
