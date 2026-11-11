"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus } from "lucide-react";
import { Button, Sticker } from "@/components/ui";
import { Field } from "@/components/app/Field";
import { Toggle } from "@/components/app/Toggle";
import { Notice } from "@/components/app/Notice";
import { useLocale, useT } from "@/i18n/client";
import { OCCASIONS, type OccasionType } from "@/lib/config";
import { api, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { resizeToWebp } from "@/lib/client/image";
import { COUPLE_TYPES, suggestTitle } from "@/lib/title";
import type { Occasion, OccasionSummary, Organisation } from "@/lib/api-types";
import { coverFallback } from "./occasion-art";

type Props = { org: Organisation | null; orgs: { id: string; name: string }[]; occasions: OccasionSummary[]; payments: boolean; pricePence: number };
type Team = { members: { hostId: string; email: string; name: string | null; role: string }[]; invites: { id: string; email: string }[] };

const TYPES = Object.keys(OCCASIONS) as OccasionType[];
const card = "rounded-[28px] border border-[#E6E8EF] p-5 sm:p-7";

export function PartnerClient({ org: initial, orgs, occasions, payments, pricePence }: Props) {
  const t = useT("host");
  const { locale } = useLocale();
  const router = useRouter();
  const [org, setOrg] = useState(initial);
  const [msg, setMsg] = useState<{ where: string; tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const price = (pricePence / 100).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
  const note = (w: string) => (msg?.where === w ? <Notice tone={msg.tone} className="mt-4">{msg.text}</Notice> : null);

  async function run<T>(where: string, fn: () => Promise<T>, ok?: string) {
    setBusy(where);
    setMsg(null);
    try {
      const r = await fn();
      if (ok) setMsg({ where, tone: "success", text: ok });
      return r;
    } catch (e) {
      setMsg({ where, tone: "error", text: errorMessage(t, e) });
      return null;
    } finally {
      setBusy(null);
    }
  }

  // ----- No partner account yet -----
  const [newName, setNewName] = useState("");
  if (!org) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-[32px] bg-ink p-7 text-white sm:p-10">
          <Sticker rotate={-4} className="self-start">{t("partner.perMonth", { price })}</Sticker>
          <h2 className="m-0 text-3xl font-black tracking-tight">{t("partner.pitchTitle")}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-muted-dark">
            {t("partner.pitchPoints").split("|").map((p) => <li key={p} className="flex gap-2"><Check size={18} aria-hidden className="mt-0.5 flex-none text-sky" />{p}</li>)}
          </ul>
          <p className="m-0 text-xs text-muted-dark">{t("partner.vatNote")}</p>
        </div>
        <form className={`${card} flex flex-col gap-4`} onSubmit={async (e) => {
          e.preventDefault();
          const r = await run("create", () => api<{ organisation: Organisation }>("/api/v1/organisations", { body: { name: newName } }));
          if (r) { setOrg(r.organisation); router.refresh(); }
        }}>
          <h2 className="m-0 text-2xl font-black">{t("partner.createTitle")}</h2>
          <Field id="org-name" label={t("partner.venueName")} placeholder={t("partner.venuePlaceholder")} required minLength={2} maxLength={80} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" size="lg" disabled={busy === "create" || newName.trim().length < 2}>{t("partner.create")}</Button>
          {note("create")}
        </form>
      </div>
    );
  }
  return <PartnerAccount org={org} setOrg={setOrg} orgs={orgs} occasions={occasions} payments={payments} price={price} run={run} note={note} busy={busy} />;
}

function PartnerAccount({ org, setOrg, orgs, occasions, payments, price, run, note, busy }: {
  org: Organisation; setOrg: (o: Organisation) => void; orgs: { id: string; name: string }[]; occasions: OccasionSummary[]; payments: boolean; price: string;
  run: <T>(where: string, fn: () => Promise<T>, ok?: string) => Promise<T | null>; note: (w: string) => React.ReactNode; busy: string | null;
}) {
  const t = useT("host");
  const { locale } = useLocale();
  const router = useRouter();
  const owner = org.role === "owner";
  const base = `/api/v1/organisations/${org.id}`;
  const [name, setName] = useState(org.name);
  const [primary, setPrimary] = useState(org.primaryColour || "#0A0A0A");
  const [accent, setAccent] = useState(org.accentColour || "#2347E0");
  const [support, setSupport] = useState(org.supportEmail || "");
  const [hidePowered, setHidePowered] = useState(org.hidePoweredBy);
  const [team, setTeam] = useState<Team | null>(null);
  const [invite, setInvite] = useState("");
  const logoInput = useRef<HTMLInputElement>(null);
  // New client event
  const [type, setType] = useState<OccasionType>("dugun");
  const [names, setNames] = useState(["", ""]);
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<"venue" | "couple" | "both">("both");
  const [coupleEmail, setCoupleEmail] = useState("");

  useEffect(() => { api<Team>(`${base}/members`).then(setTeam).catch(() => {}); }, [base]);

  const statusLabel = t(`partner.status.${org.status}`);
  return (
    <div className="flex flex-col gap-5">
      {orgs.length > 1 ? (
        <nav aria-label={t("partner.switch")} className="flex flex-wrap gap-2">
          {orgs.map((o) => <Link key={o.id} href={`?org=${o.id}`} aria-current={o.id === org.id ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold no-underline ${o.id === org.id ? "bg-ink text-white" : "bg-tint text-ink"}`}>{o.name}</Link>)}
        </nav>
      ) : null}

      <section className={`${card} flex flex-wrap items-center justify-between gap-4 ${org.active ? "" : "border-royal"}`} aria-labelledby="sub-h">
        <div className="flex flex-col gap-1">
          <h2 id="sub-h" className="m-0 text-xl font-black">{t("partner.subscription")}</h2>
          <p className="m-0 text-sm text-muted">{statusLabel}{org.currentPeriodEnd && org.active ? ` · ${t("partner.renews", { date: formatDate(org.currentPeriodEnd, locale) })}` : ""}</p>
          {!org.active ? <p className="m-0 text-sm font-semibold text-royal">{t("partner.inactiveHint", { price })}</p> : null}
        </div>
        {owner ? (
          payments ? (
            org.status === "active" || org.status === "trialing" || org.status === "past_due" ? (
              <Button variant="secondary" disabled={busy === "billing"} onClick={async () => { const r = await run("billing", () => api<{ url: string }>(`${base}/portal`, { body: {} })); if (r) window.location.assign(r.url); }}>{t("partner.manageBilling")}</Button>
            ) : (
              <Button disabled={busy === "billing"} onClick={async () => { const r = await run("billing", () => api<{ url: string }>(`${base}/checkout`, { body: {} })); if (r) window.location.assign(r.url); }}>{t("partner.subscribe", { price })}</Button>
            )
          ) : <span className="text-sm font-bold">{t("plan.comingSoon")}</span>
        ) : null}
        <p className="m-0 w-full text-xs text-muted">{t("partner.vatNote")}</p>
        {note("billing")}
      </section>

      <section className={card} aria-labelledby="ev-h">
        <h2 id="ev-h" className="m-0 mb-4 text-xl font-black">{t("partner.events")}</h2>
        {occasions.length ? (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {occasions.map((o) => (
              <li key={o.id}>
                <Link href={`/dashboard/${o.id}`} className="flex items-center gap-3 rounded-2xl bg-tint p-3 text-ink no-underline hover:bg-[#E4E8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.coverUrl || coverFallback(o.type)} alt="" className="h-16 w-16 flex-none rounded-xl object-cover" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-extrabold">{o.title}</span>
                    <span className="text-sm text-muted">{[o.startsOn ? formatDate(o.startsOn, locale) : null, t("dashboard.counts", { media: o.mediaCount, guests: o.guestCount })].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="m-0 text-muted">{t("partner.noEvents")}</p>}

        <form className="mt-6 flex flex-col gap-4 rounded-[24px] bg-tint p-5" onSubmit={async (e) => {
          e.preventDefault();
          const honorees = names.map((n) => n.trim()).filter(Boolean);
          const r = await run("event", () => api<{ occasion: Occasion }>(`${base}/occasions`, {
            body: { type, title: suggestTitle(type, honorees, locale), honorees, startsOn: date || null, brandingMode: mode, coupleEmail: coupleEmail || null },
          }));
          if (r) window.location.assign(`/dashboard/${r.occasion.id}/settings`);
        }}>
          <h3 className="m-0 text-lg font-black">{t("partner.newEvent")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="pe-type" className="text-[13px] font-semibold text-text-2">{t("partner.eventType")}</label>
              <select id="pe-type" value={type} onChange={(e) => { const v = e.target.value as OccasionType; setType(v); setNames(COUPLE_TYPES.includes(v) ? ["", ""] : [""]); }}
                className="min-h-12 rounded-2xl border-[1.5px] border-[#D5D8E2] bg-white px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">
                {TYPES.map((k) => <option key={k} value={k}>{OCCASIONS[k].label[locale]}</option>)}
              </select>
            </div>
            <Field id="pe-date" type="date" label={t("wizard.date")} value={date} onChange={(e) => setDate(e.target.value)} />
            {names.map((n, i) => (
              <Field key={i} id={`pe-n${i}`} label={t("wizard.nameLabel", { n: i + 1 })} value={n} maxLength={60} required={i === 0} onChange={(e) => setNames((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
            ))}
            <Field id="pe-email" type="email" className="sm:col-span-2" label={t("partner.coupleEmail")} hint={t("partner.coupleEmailHint")} value={coupleEmail} onChange={(e) => setCoupleEmail(e.target.value)} />
          </div>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 p-0 text-[13px] font-semibold text-text-2">{t("branding.title")}</legend>
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
              {(["venue", "couple", "both"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                  className={`flex flex-col gap-1 rounded-2xl border-2 bg-white p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${mode === m ? "border-royal" : "border-transparent"}`}>
                  <span className="font-extrabold">{t(`branding.${m}`)}</span>
                  <span className="text-xs text-muted">{t(`branding.${m}Hint`)}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <Button type="submit" className="self-start" disabled={busy === "event" || !org.active || !names[0]?.trim()}>{t("partner.createEvent")}</Button>
          {!org.active ? <p className="m-0 text-sm text-royal">{t("partner.needsSub")}</p> : null}
          {note("event")}
        </form>
      </section>

      <section className={card} aria-labelledby="br-h">
        <h2 id="br-h" className="m-0 mb-4 text-xl font-black">{t("partner.brand")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="o-name" label={t("partner.venueName")} value={name} maxLength={80} disabled={!owner} onChange={(e) => setName(e.target.value)} />
          <Field id="o-support" type="email" label={t("partner.supportEmail")} value={support} disabled={!owner} onChange={(e) => setSupport(e.target.value)} />
          <div className="flex items-end gap-3">
            <Field id="o-primary" label={t("partner.primary")} value={primary} disabled={!owner} onChange={(e) => setPrimary(e.target.value)} className="flex-1" />
            <input type="color" aria-label={t("partner.primary")} value={/^#[0-9a-f]{6}$/i.test(primary) ? primary : "#0a0a0a"} disabled={!owner} onChange={(e) => setPrimary(e.target.value)} className="h-12 w-14 rounded-xl border-0" />
          </div>
          <div className="flex items-end gap-3">
            <Field id="o-accent" label={t("partner.accent")} value={accent} disabled={!owner} onChange={(e) => setAccent(e.target.value)} className="flex-1" />
            <input type="color" aria-label={t("partner.accent")} value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : "#2347e0"} disabled={!owner} onChange={(e) => setAccent(e.target.value)} className="h-12 w-14 rounded-xl border-0" />
          </div>
        </div>
        <div className="mt-5"><Toggle checked={hidePowered} disabled={!owner} onChange={setHidePowered} label={t("partner.hidePowered")} description={t("partner.hidePoweredHint")} /></div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-40 items-center justify-center rounded-2xl p-2" style={{ background: primary }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {org.logoUrl ? <img src={org.logoUrl} alt="" className="max-h-full max-w-full object-contain" /> : <span className="font-serif text-white">{name}</span>}
          </div>
          {owner ? (
            <>
              <Button variant="secondary" disabled={busy === "logo"} onClick={() => logoInput.current?.click()}><ImagePlus size={18} aria-hidden />{t("partner.logo")}</Button>
              <input ref={logoInput} type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                await run("brand", async () => {
                  const blob = f.type === "image/png" ? f : (await resizeToWebp(f, 800)) ?? f;
                  const mime = blob === f ? f.type : "image/webp";
                  const r = await api<{ key: string; upload: { url: string; headers: Record<string, string> } }>(`${base}/logo`, { body: { mime, bytes: blob.size } });
                  const put = await fetch(r.upload.url, { method: "PUT", headers: r.upload.headers, body: blob });
                  if (!put.ok) throw new Error("upload");
                  const d = await api<{ organisation: Organisation }>(`${base}/logo/complete`, { body: { key: r.key } });
                  setOrg(d.organisation);
                }, t("settings.saved"));
              }} />
            </>
          ) : null}
        </div>
        {owner ? (
          <Button className="mt-5" disabled={busy === "brand"} onClick={async () => {
            const r = await run("brand", () => api<{ organisation: Organisation }>(base, { method: "PATCH", body: {
              name, supportEmail: support || null, hidePoweredBy: hidePowered,
              primaryColour: /^#[0-9a-f]{6}$/i.test(primary) ? primary : null, accentColour: /^#[0-9a-f]{6}$/i.test(accent) ? accent : null,
            } }), t("settings.saved"));
            if (r) { setOrg(r.organisation); router.refresh(); }
          }}>{t("common.save")}</Button>
        ) : null}
        {note("brand")}
      </section>

      <section className={card} aria-labelledby="st-h">
        <h2 id="st-h" className="m-0 mb-4 text-xl font-black">{t("partner.staff")}</h2>
        <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          {team?.members.map((m) => (
            <li key={m.hostId} className="flex items-center justify-between gap-3 rounded-2xl bg-tint px-4 py-3">
              <span className="min-w-0 truncate"><strong>{m.name || m.email}</strong> <span className="text-sm text-muted">· {m.role === "owner" ? t("team.owner") : t("partner.staffRole")}</span></span>
              {owner && m.role !== "owner" ? <button type="button" className="min-h-11 text-sm font-bold text-[#8A1C1C]" onClick={async () => { const r = await run("staff", () => api<Team>(`${base}/members?hostId=${m.hostId}`, { method: "DELETE" })); if (r) setTeam(r); }}>{t("team.remove")}</button> : null}
            </li>
          ))}
          {team?.invites.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#C8CAD2] px-4 py-3">
              <span className="truncate">{i.email} <span className="text-sm text-muted">· {t("team.pending")}</span></span>
              {owner ? <button type="button" className="min-h-11 text-sm font-bold text-[#8A1C1C]" onClick={async () => { const r = await run("staff", () => api<Team>(`${base}/members?inviteId=${i.id}`, { method: "DELETE" })); if (r) setTeam(r); }}>{t("team.cancelInvite")}</button> : null}
            </li>
          ))}
        </ul>
        {owner ? (
          <form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); const r = await run("staff", () => api<Team>(`${base}/members`, { body: { email: invite } }), t("team.invited")); if (r) { setTeam(r); setInvite(""); } }}>
            <Field id="st-email" type="email" required className="min-w-56 flex-1" label={t("team.email")} value={invite} onChange={(e) => setInvite(e.target.value)} />
            <Button type="submit" disabled={busy === "staff"}>{t("team.invite")}</Button>
          </form>
        ) : null}
        {note("staff")}
      </section>
    </div>
  );
}
