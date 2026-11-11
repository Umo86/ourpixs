import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { hostApi } from "@/api/client";
import type { Occasion, OccasionPatch, Stats } from "@/api/types";

type Ctx = {
  id: string;
  occasion: Occasion | null;
  stats: Stats | null;
  error: unknown;
  refresh: () => Promise<void>;
  patch: (p: OccasionPatch) => Promise<Occasion>;
};

const OccasionCtx = createContext<Ctx | null>(null);

/** Loads one event for all of its host tabs and shares updates between them. */
export function OccasionProvider({ id, children }: { id: string; children: ReactNode }) {
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await hostApi.get(id);
      setOccasion(res.occasion);
      setStats(res.stats);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [id]);

  useEffect(() => {
    setOccasion(null);
    void refresh();
  }, [refresh]);

  const patch = useCallback(
    async (p: OccasionPatch) => {
      const res = await hostApi.update(id, p);
      setOccasion(res.occasion);
      return res.occasion;
    },
    [id],
  );

  return <OccasionCtx.Provider value={{ id, occasion, stats, error, refresh, patch }}>{children}</OccasionCtx.Provider>;
}

export function useOccasion(): Ctx {
  const c = useContext(OccasionCtx);
  if (!c) throw new Error("useOccasion must be used inside <OccasionProvider>");
  return c;
}
