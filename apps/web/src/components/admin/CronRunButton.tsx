"use client";
import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui";
import { Notice } from "@/components/app/Notice";
import { useT } from "@/i18n/client";
import { Dialog, useAdminRequest } from "./AdminAction";

/** "Run now" for one cron job (server-side, admin-only, audited). */
export function CronRunButton({ name, label }: { name: string; label: string }) {
  const t = useT("admin");
  const { run, busy, error } = useAdminRequest();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" disabled={busy} onClick={() => { setDone(false); setOpen(true); }}><Play size={16} aria-hidden />{busy ? t("system.running") : t("system.runNow")}</Button>
      {done ? <Notice tone="success">{t("system.runDone")}</Notice> : null}
      {error && !open ? <Notice tone="error">{error}</Notice> : null}
      <Dialog open={open} onClose={() => setOpen(false)} title={t("system.runTitle", { name: label })}>
        <p className="m-0 text-[15px] text-text-2">{t(`system.runBody.${name}`)}</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled={busy} onClick={async () => { if (await run(`/api/admin/cron/${name}`, "POST", {})) { setOpen(false); setDone(true); } }}>
            {busy ? t("system.running") : t("system.runConfirm")}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
        </div>
      </Dialog>
    </div>
  );
}
