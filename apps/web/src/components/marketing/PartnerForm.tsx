"use client";
import Link from "next/link";
import { useActionState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/i18n/client";
import { Button } from "@/components/ui/Button";
import { submitEnquiry, type EnquiryField, type EnquiryState } from "@/app/(marketing)/actions";

const TYPES = ["venue", "dj", "photographer", "planner", "other"] as const;
const input =
  "block min-h-12 w-full rounded-2xl border-[1.5px] border-muted-dark bg-white px-4 py-3 text-base text-ink placeholder:text-muted focus-visible:border-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky aria-[invalid=true]:border-[#C62828]";

export function PartnerForm({ kind = "partner" }: { kind?: "partner" | "contact" }) {
  const t = useT("marketing");
  const [state, action, pending] = useActionState<EnquiryState, FormData>(submitEnquiry, { status: "idle" });
  const bad = (f: EnquiryField) => state.status === "error" && state.fields?.includes(f);

  if (state.status === "ok") {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-[28px] bg-white p-8 sm:p-10">
        <h3 className="m-0 text-3xl font-black tracking-[-0.04em]">{t("partners.form.okTitle")}</h3>
        <p className="m-0 text-lg text-text-2">{t("partners.form.okBody")}</p>
      </div>
    );
  }

  const err = (f: EnquiryField, key: string) =>
    bad(f) ? <p id={`${f}-err`} role="alert" className="m-0 mt-1.5 text-sm font-medium text-[#C62828]">{t(key)}</p> : null;

  return (
    <form action={action} noValidate className="flex flex-col gap-5 rounded-[28px] bg-white p-6 sm:p-10">
      <input type="hidden" name="kind" value={kind} />
      {/* honeypot */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-name" className="mb-1.5 block text-sm font-bold">{t("partners.form.name")}</label>
          <input id="pf-name" name="name" required autoComplete="name" aria-invalid={bad("name") || undefined} aria-describedby={bad("name") ? "name-err" : undefined} className={input} />
          {err("name", "partners.form.errName")}
        </div>
        <div>
          <label htmlFor="pf-email" className="mb-1.5 block text-sm font-bold">{t("partners.form.email")}</label>
          <input id="pf-email" name="email" type="email" required autoComplete="email" inputMode="email" aria-invalid={bad("email") || undefined} aria-describedby={bad("email") ? "email-err" : undefined} className={input} />
          {err("email", "partners.form.errEmail")}
        </div>
        <div>
          <label htmlFor="pf-company" className="mb-1.5 block text-sm font-bold">{t("partners.form.company")}</label>
          <input id="pf-company" name="company" autoComplete="organization" className={input} />
        </div>
        <div>
          <label htmlFor="pf-type" className="mb-1.5 block text-sm font-bold">{t("partners.form.type")}</label>
          <div className="relative">
            <select id="pf-type" name="type" defaultValue="venue" aria-invalid={bad("type") || undefined} className={`${input} appearance-none pr-11`}>
              {TYPES.map((k) => <option key={k} value={k}>{t(`partners.form.types.${k}`)}</option>)}
            </select>
            <ChevronDown aria-hidden size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="pf-message" className="mb-1.5 block text-sm font-bold">{t("partners.form.message")}</label>
        <textarea id="pf-message" name="message" rows={4} maxLength={2000} className={`${input} resize-y`} />
      </div>
      {state.status === "error" && state.code === "server" ? (
        <p role="alert" className="m-0 text-sm font-medium text-[#C62828]">{t("partners.form.errServer")}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>{pending ? t("partners.form.sending") : t("partners.form.submit")}</Button>
        <p className="m-0 max-w-[340px] text-sm text-muted">
          {t("partners.form.privacy")} <Link href="/privacy" className="text-royal underline">{t("partners.form.privacyLink")}</Link>
        </p>
      </div>
    </form>
  );
}
