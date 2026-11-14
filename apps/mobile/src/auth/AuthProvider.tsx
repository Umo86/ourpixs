import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { authApi, onUnauthorized, setHostToken } from "@/api/client";
import type { Host } from "@/api/types";
import { storage } from "@/lib/storage";

const TOKEN_KEY = "op_host_token";
const HOST_KEY = "op_host_profile";

type AuthCtx = {
  ready: boolean;
  token: string | null;
  host: Host | null;
  /** Re-reads /me (profile). Payments are per event (Occasion.package), so there is no account plan here. */
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

  const signOut = useCallback(async () => {
    setHostToken(null);
    setToken(null);
    setHostState(null);
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
          .then(({ host: fresh }) => {
            if (!alive) return;
            setHostState(fresh);
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
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { host: fresh } = await authApi.me();
      setHostState(fresh);
      void storage.setJSON(HOST_KEY, fresh);
    } catch {
      // keep what we have; a 401 signs out via onUnauthorized
    }
  }, []);

  const setHost = useCallback((h: Host) => {
    setHostState(h);
    void storage.setJSON(HOST_KEY, h);
  }, []);

  const value = useMemo(() => ({ ready, token, host, refreshMe, signIn, signOut, setHost }), [ready, token, host, refreshMe, signIn, signOut, setHost]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}
