"use client";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { Notice } from "@/components/app/Notice";
import { useT } from "@/i18n/client";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";

/** Calls an admin API route; refreshes the page on success. A stale admin sign-in goes back to /login. */
export function useAdminRequest() {
  const t = useT("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (path: string, method: string, body: unknown, redirectTo?: string) => {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method, body });
      if (redirectTo) router.push(redirectTo);
      router.refresh();
      return true;
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "reauth_required") {
        window.location.assign("/login?next=/admin&reauth=1");
        return false;
      }
      setError(errorMessage(t, e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [router, t]);
  return { run, busy, error, setError };
}

/** Accessible modal: focus moves in, Esc and the backdrop close it, focus returns to the opener. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useT("admin");
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-[28px] bg-white p-6 text-ink shadow-2xl focus:outline-none sm:p-7">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><X size={18} aria-hidden /></button>
        <h2 id={id} className="m-0 pr-12 text-2xl font-black tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export type ActionField =
  | { kind: "reason"; required?: boolean }
  | { kind: "number"; name: string; label: string; min: number; max: number; initial: number }
  | { kind: "date"; name: string; label: string; min: string; initial: string }
  | { kind: "choice"; name: string; label: string; options: { value: string; label: string }[]; initial: string }
  | { kind: "typed"; name: string; label: string; expected: string };

type Props = {
  /** Button text and style. */
  label: string;
  tone?: "primary" | "secondary" | "danger";
  title: string;
  body?: string;
  confirmLabel: string;
  endpoint: string;
  method: "POST" | "PATCH" | "DELETE";
  /** Sent as-is, merged with the field values (reason → `reason`, others by `name`). */
  payload?: Record<string, unknown>;
  fields?: ActionField[];
  /** Where to go after success (e.g. back to the list after a delete); otherwise the page refreshes. */
  redirectTo?: string;
  disabled?: boolean;
};

const inputCls = "min-h-12 w-full rounded-2xl border-[1.5px] border-[#D5D8E2] bg-white px-4 py-3 text-base text-ink outline-none focus-visible:border-sky focus-visible:ring-2 focus-visible:ring-sky";
const DANGER = "border-[#B42318]! text-[#B42318]! hover:bg-[#B42318]! hover:text-white!";

/**
 * A button that opens a confirm dialog (reason and other fields), then calls an admin API route.
 * Everything it needs is plain data, so server pages render it directly.
 */
export function AdminAction({ label, tone = "secondary", title, body, confirmLabel, endpoint, method, payload = {}, fields = [{ kind: "reason", required: true }], redirectTo, disabled }: Props) {
  const t = useT("admin");
  const [open, setOpen] = useState(false);
  const initial = useCallback(() => Object.fromEntries(fields.map((f) =>
    f.kind === "reason" ? ["reason", ""] : f.kind === "typed" ? [f.name, ""] : [f.name, String(f.initial)])), [fields]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const { run, busy, error, setError } = useAdminRequest();
  const baseId = useId();
  const close = useCallback(() => { setOpen(false); setError(null); }, [setError]);

  const reasonField = fields.find((f) => f.kind === "reason") as Extract<ActionField, { kind: "reason" }> | undefined;
  const typedOk = fields.every((f) => f.kind !== "typed" || values[f.name]?.trim().toLowerCase() === f.expected.toLowerCase());
  const reasonOk = !reasonField?.required || (values.reason?.trim().length ?? 0) >= 3;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!typedOk || !reasonOk) return;
    const out: Record<string, unknown> = { ...payload };
    for (const f of fields) {
      const v = f.kind === "reason" ? values.reason : values[f.name];
      if (f.kind === "number") out[f.name] = Number(v);
      else if (f.kind === "reason") { if (v?.trim()) out.reason = v.trim(); }
      else out[f.name] = v?.trim();
    }
    const ok = await run(endpoint, method, out, redirectTo);
    if (ok) { setOpen(false); setValues(initial()); }
  }

  return (
    <>
      <Button variant={tone === "primary" ? "primary" : "secondary"} className={tone === "danger" ? DANGER : ""} disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={close} title={title}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {body ? <p className="m-0 text-[15px] text-text-2">{body}</p> : null}
          {fields.map((f, i) => {
            const id = `${baseId}-${i}`;
            if (f.kind === "reason") {
              return (
                <div key={id} className="flex flex-col gap-2">
                  <label htmlFor={id} className="text-[13px] font-semibold text-text-2">{f.required ? t("common.reason") : t("common.reasonOptional")}</label>
                  <textarea id={id} required={f.required} minLength={f.required ? 3 : undefined} maxLength={500} rows={3} value={values.reason ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))} className={`${inputCls} resize-y`} />
                  <span className="text-xs text-muted">{t("common.reasonHint")}</span>
                </div>
              );
            }
            if (f.kind === "choice") {
              return (
                <fieldset key={id} className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 text-[13px] font-semibold text-text-2">{f.label}</legend>
                  {f.options.map((o) => (
                    <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] border-[#D5D8E2] px-4 has-[:checked]:border-royal">
                      <input type="radio" name={id} value={o.value} checked={values[f.name] === o.value} onChange={() => setValues((v) => ({ ...v, [f.name]: o.value }))}
                        className="h-4 w-4 accent-[#2347E0]" />
                      <span className="text-[15px] font-semibold">{o.label}</span>
                    </label>
                  ))}
                </fieldset>
              );
            }
            return (
              <div key={id} className="flex flex-col gap-2">
                <label htmlFor={id} className="text-[13px] font-semibold text-text-2">{f.label}</label>
                <input id={id} required
                  type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
                  min={f.kind === "number" ? f.min : f.kind === "date" ? f.min : undefined}
                  max={f.kind === "number" ? f.max : undefined}
                  autoComplete="off" spellCheck={false}
                  value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className={inputCls} />
              </div>
            );
          })}
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant={tone === "danger" ? "secondary" : "primary"} className={tone === "danger" ? DANGER : ""} disabled={busy || !typedOk || !reasonOk}>
              {busy ? t("common.working") : confirmLabel}
            </Button>
            <Button variant="secondary" onClick={close} disabled={busy}>{t("common.cancel")}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** One-click admin request (no dialog), e.g. "Mark handled". */
export function AdminQuickAction({ label, busyLabel, endpoint, method, payload, variant = "secondary" }: {
  label: string; busyLabel: string; endpoint: string; method: "POST" | "PATCH"; payload: Record<string, unknown>; variant?: "primary" | "secondary";
}) {
  const { run, busy, error } = useAdminRequest();
  return (
    <div className="flex flex-col gap-2">
      <Button variant={variant} disabled={busy} onClick={() => run(endpoint, method, payload)}>{busy ? busyLabel : label}</Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
