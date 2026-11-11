"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Notice } from "@/components/app/Notice";
import { useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";

export function DeleteAccountButton() {
  const t = useT("host");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    const typed = window.prompt(t("accountDelete.confirm"));
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== t("accountDelete.confirmWord").toUpperCase()) { setError(t("accountDelete.mismatch")); return; }
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/me", { method: "DELETE" });
      window.location.assign("/");
    } catch (e) {
      setError(errorMessage(t, e));
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" className="self-start border-[#B42318]! text-[#B42318]! hover:bg-[#B42318]! hover:text-white!" disabled={busy} onClick={go}>
        <Trash2 size={18} aria-hidden />{busy ? t("accountDelete.deleting") : t("accountDelete.button")}
      </Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
