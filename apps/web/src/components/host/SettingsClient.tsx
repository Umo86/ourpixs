"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Field } from "@/components/app/Field";
import { Toggle } from "@/components/app/Toggle";
import { Notice } from "@/components/app/Notice";
import { ShareButtons } from "@/components/app/ShareButtons";
import { useLocale, useT } from "@/i18n/client";
import { FEATURES, THEMES } from "@/lib/config";
import { api, errorMessage } from "@/lib/client/api";
import { fromLocalInput, toLocalInput } from "@/lib/client/datetime";
import { formatDate } from "@/lib/client/format";
import { resizeToWebp } from "@/lib/client/image";
import type { Occasion, ShareLink, Theme } from "@/lib/api-types";
import { WindowEditor } from "./EventPackage";

type Props = { initial: Occasion; isOwner: boolean; storage: boolean };
type DayDraft = { id?: string; name: string; date: string; opens: string; closes: string };

const THEME_KEYS = Object.keys(THEMES) as Theme[];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 rounded-[28px] border border-[#E6E8EF] p-5 sm:p-7">
      <h2 id={`${id}-h`} className="m-0 mb-5 flex items-center gap-2 text-xl font-black tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsClient({ initial, isOwner, storage }: Props) {
  const t = useT("host");
  const { locale } = useLocale();
  const router = useRouter();
  const [o, setO] = useState(initial);
  const maxDays = FEATURES.maxDays;
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ section: string; tone: "success" | "error"; text: string } | null>(null);

  // Details
  const [title, setTitle] = useState(o.title);
  const [honorees, setHonorees] = useState(o.honorees.join(", "));
  const [startsOn, setStartsOn] = useState(o.startsOn || "");
  const [venueName, setVenue] = useState(o.venueName || "");
  const [city, setCity] = useState(o.city || "");
  const [theme, setTheme] = useState<Theme>(o.theme);
  const [vanity, setVanity] = useState(o.vanitySlug || "");
  // Days
  const [days, setDays] = useState<DayDraft[]>(o.days.map((d) => ({ id: d.id, name: d.name, date: d.date || "", opens: toLocalInput(d.uploadOpensAt), closes: toLocalInput(d.uploadClosesAt) })));
  // Uploads & privacy (the gallery window itself is edited in the "Gallery dates" section)
  const [approval, setApproval] = useState(o.approvalMode);
  const [reveal, setReveal] = useState(o.revealMode);
  const [revealAt, setRevealAt] = useState(toLocalInput(o.revealAt));
  const [pin, setPin] = useState("");
  const [shots, setShots] = useState(o.disposableShots ? String(o.disposableShots) : "");
  // Lists
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkScope, setLinkScope] = useState<"view" | "view_upload">("view");
  const [team, setTeam] = useState<{ members: { hostId: string; email: string; name: string | null; role: string }[]; invites: { id: string; email: string }[] } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ links: ShareLink[] }>(`/api/v1/occasions/${o.id}/share-links`).then((r) => setLinks(r.links)).catch(() => setLinks([]));
    api<NonNullable<typeof team>>(`/api/v1/occasions/${o.id}/cohosts`).then(setTeam).catch(() => {});
  }, [o.id]);

  async function save(section: string, body: Record<string, unknown>) {
    setSaving(section);
    setFlash(null);
    try {
      const r = await api<{ occasion: Occasion }>(`/api/v1/occasions/${o.id}`, { method: "PATCH", body });
      setO(r.occasion);
      setFlash({ section, tone: "success", text: t("settings.saved") });
      router.refresh();
      return r.occasion;
    } catch (e) {
      setFlash({ section, tone: "error", text: errorMessage(t, e) });
      return null;
    } finally {
      setSaving(null);
    }
  }

  const msg = (section: string) => (flash?.section === section ? <Notice tone={flash.tone} className="mt-4">{flash.text}</Notice> : null);
  const saveBtn = (section: string, onClick: () => void) => (
    <Button className="mt-5" disabled={saving === section} onClick={onClick}>{saving === section ? t("settings.saving") : t("common.save")}</Button>
  );

  async function uploadCover(file: File) {
    setSaving("cover");
    setFlash(null);
    try {
      const blob = await resizeToWebp(file, 2000);
      if (!blob) throw new Error("resize");
      const r = await api<{ key: string; upload: { url: string; headers: Record<string, string> } }>(`/api/v1/occasions/${o.id}/cover`, { body: { mime: "image/webp", bytes: blob.size } });
      const put = await fetch(r.upload.url, { method: "PUT", headers: r.upload.headers, body: blob });
      if (!put.ok) throw new Error("put");
      const done = await api<{ occasion: Occasion }>(`/api/v1/occasions/${o.id}/cover/complete`, { body: { key: r.key } });
      setO(done.occasion);
      setFlash({ section: "cover", tone: "success", text: t("settings.coverSaved") });
      router.refresh();
    } catch (e) {
      setFlash({ section: "cover", tone: "error", text: e instanceof Error && (e.message === "resize" || e.message === "put") ? t("settings.coverFailed") : errorMessage(t, e) });
    } finally {
      setSaving(null);
    }
  }

  async function removeCover() {
    try {
      const r = await api<{ occasion: Occasion }>(`/api/v1/occasions/${o.id}/cover`, { method: "DELETE" });
      setO(r.occasion);
      router.refresh();
    } catch (e) {
      setFlash({ section: "cover", tone: "error", text: errorMessage(t, e) });
    }
  }

  async function createLink() {
    try {
      const r = await api<{ links: ShareLink[] }>(`/api/v1/occasions/${o.id}/share-links`, { body: { label: linkLabel || null, scope: linkScope } });
      setLinks(r.links);
      setLinkLabel("");
    } catch (e) {
      setFlash({ section: "share", tone: "error", text: errorMessage(t, e) });
    }
  }
  async function revokeLink(id: string) {
    if (!window.confirm(t("share.confirmRevoke"))) return;
    const r = await api<{ links: ShareLink[] }>(`/api/v1/occasions/${o.id}/share-links?linkId=${id}`, { method: "DELETE" }).catch(() => null);
    if (r) setLinks(r.links);
  }
  async function invite() {
    try {
      setTeam(await api(`/api/v1/occasions/${o.id}/cohosts`, { body: { email: inviteEmail } }));
      setInviteEmail("");
      setFlash({ section: "team", tone: "success", text: t("team.invited") });
    } catch (e) {
      setFlash({ section: "team", tone: "error", text: errorMessage(t, e) });
    }
  }
  async function removeMember(q: string) {
    setTeam(await api(`/api/v1/occasions/${o.id}/cohosts?${q}`, { method: "DELETE" }));
  }
  async function destroy() {
    const typed = window.prompt(t("danger.confirmPrompt", { title: o.title }));
    if (typed === null) return;
    if (typed.trim() !== o.title.trim()) { setFlash({ section: "danger", tone: "error", text: t("danger.mismatch") }); return; }
    setSaving("danger");
    try {
      await api(`/api/v1/occasions/${o.id}`, { method: "DELETE" });
      window.location.assign("/dashboard");
    } catch (e) {
      setFlash({ section: "danger", tone: "error", text: errorMessage(t, e) });
      setSaving(null);
    }
  }

  const select = "min-h-12 w-full rounded-2xl border-[1.5px] border-[#D5D8E2] bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";
  const shareLabels = { whatsapp: t("share.whatsapp"), share: t("share.native"), copy: t("common.copyLink"), copied: t("common.copied") };
  return (
    <div className="flex flex-col gap-5">
      <Section id="gallery" title={t("settings.gallery")}>
        <WindowEditor occasion={o} onSaved={setO} />
      </Section>

      <Section id="details" title={t("settings.details")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="s-title" className="sm:col-span-2" label={t("wizard.titleLabel")} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          <Field id="s-names" className="sm:col-span-2" label={t("settings.honorees")} hint={t("settings.honoreesHint")} value={honorees} onChange={(e) => setHonorees(e.target.value)} />
          <Field id="s-date" type="date" label={t("wizard.date")} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          <Field id="s-city" label={t("wizard.city")} value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} />
          <Field id="s-venue" className="sm:col-span-2" label={t("wizard.venue")} value={venueName} maxLength={120} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <fieldset className="m-0 mt-5 border-0 p-0">
          <legend className="mb-3 p-0 text-[13px] font-semibold text-text-2">{t("wizard.themeTitle")}</legend>
          <div role="radiogroup" className="grid grid-cols-6 gap-2">
            {THEME_KEYS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={theme === k} aria-label={t(`themes.${k}`)} onClick={() => setTheme(k)}
                className={`aspect-square rounded-2xl border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2 ${theme === k ? "border-royal" : "border-[#E2E4EC]"}`}
                style={{ background: `linear-gradient(135deg, ${THEMES[k].bg} 60%, ${THEMES[k].accent} 60%)` }} />
            ))}
          </div>
        </fieldset>
        {saveBtn("details", () => save("details", {
          title, honorees: honorees.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4), startsOn: startsOn || null,
          venueName: venueName || null, city: city || null, theme,
        }))}
        {msg("details")}
      </Section>

      <Section id="link" title={t("settings.link")}>
        <p className="m-0 mb-4 text-sm text-muted">{t("settings.linkHint")}</p>
        <div className="flex flex-col gap-2">
          <label htmlFor="s-vanity" className="text-[13px] font-semibold text-text-2">{t("settings.linkName")}</label>
          <div className="flex min-h-12 items-center overflow-hidden rounded-2xl border-[1.5px] border-[#D5D8E2] focus-within:ring-2 focus-within:ring-sky">
            <span className="whitespace-nowrap bg-tint px-3 py-3 text-sm text-muted">{o.guestUrl.replace(/^https?:\/\//, "").replace(/\/g\/.*$/, "/g/")}</span>
            <input id="s-vanity" value={vanity} maxLength={40} placeholder={t("settings.linkPlaceholder")}
              onChange={(e) => setVanity(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="min-w-0 flex-1 px-3 py-3 text-base outline-none" />
          </div>
        </div>
        {saveBtn("link", () => save("link", { vanitySlug: vanity || null }))}
        {msg("link")}
        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-tint p-4">
          <code className="break-all text-[15px] font-semibold">{o.guestUrl}</code>
          <ShareButtons url={o.guestUrl} text={t("share.guestMessage", { title: o.title })} title={o.title} labels={shareLabels} />
        </div>
      </Section>

      <Section id="cover" title={t("settings.cover")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-tint sm:w-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {o.coverUrl ? <img src={o.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-muted">{t("settings.coverHint")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!storage || saving === "cover"} onClick={() => coverInput.current?.click()}><ImagePlus size={18} aria-hidden />{saving === "cover" ? t("settings.saving") : t("settings.coverUpload")}</Button>
              {o.coverUrl ? <Button variant="ghost" onClick={removeCover}>{t("settings.coverRemove")}</Button> : null}
            </div>
            <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCover(f); e.target.value = ""; }} />
          </div>
        </div>
        {msg("cover")}
      </Section>

      <Section id="days" title={t("settings.days")}>
        <p className="m-0 mb-4 text-sm text-muted">{t("settings.daysHint", { max: maxDays })}</p>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {days.map((d, i) => {
            const server = o.days.find((x) => x.id === d.id);
            return (
              <li key={d.id || `new-${i}`} className="flex flex-col gap-3 rounded-2xl bg-tint p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <Field id={`d-name-${i}`} className="min-w-40 flex-1" label={t("wizard.dayName")} value={d.name} maxLength={60} onChange={(e) => setDays((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Field id={`d-date-${i}`} type="date" label={t("wizard.date")} value={d.date} onChange={(e) => setDays((a) => a.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
                  {days.length > 1 ? (
                    <button type="button" aria-label={t("settings.removeDay", { name: d.name })} onClick={() => setDays((a) => a.filter((_, j) => j !== i))}
                      className="mb-0.5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><Trash2 size={18} aria-hidden /></button>
                  ) : null}
                </div>
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-royal">{t("settings.dayWindow")}</summary>
                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <Field id={`d-open-${i}`} type="datetime-local" label={t("settings.opens")} value={d.opens} onChange={(e) => setDays((a) => a.map((x, j) => (j === i ? { ...x, opens: e.target.value } : x)))} />
                    <Field id={`d-close-${i}`} type="datetime-local" label={t("settings.closes")} value={d.closes} onChange={(e) => setDays((a) => a.map((x, j) => (j === i ? { ...x, closes: e.target.value } : x)))} />
                  </div>
                </details>
                {server?.guestUrl ? (
                  server.active === false
                    ? <p className="m-0 text-sm font-semibold text-royal">{t("settings.dayLocked", { max: maxDays })}</p>
                    : <p className="m-0 break-all text-sm text-muted">{t("settings.dayLink")} <code className="font-semibold text-ink">{server.guestUrl}</code></p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {days.length < maxDays ? (
          <Button variant="ghost" className="mt-4" onClick={() => setDays((a) => [...a, { name: t("wizard.newDay", { n: a.length + 1 }), date: "", opens: "", closes: "" }])}>{t("wizard.addDay")}</Button>
        ) : null}
        {saveBtn("days", () => save("days", { days: days.map((d) => ({ id: d.id, name: d.name.trim() || "—", date: d.date || null, uploadOpensAt: fromLocalInput(d.opens), uploadClosesAt: fromLocalInput(d.closes) })) }).then((r) => {
          if (r) setDays(r.days.map((d) => ({ id: d.id, name: d.name, date: d.date || "", opens: toLocalInput(d.uploadOpensAt), closes: toLocalInput(d.uploadClosesAt) })));
        }))}
        {msg("days")}
      </Section>

      <Section id="uploads" title={t("settings.uploads")}>
        <div className="flex flex-col gap-6">
          <Toggle checked={approval} onChange={setApproval} label={t("settings.approval")} description={t("settings.approvalHint")} />
          <div className="flex flex-col gap-2">
            <label htmlFor="s-reveal" className="text-[15px] font-bold">{t("settings.reveal")}</label>
            <select id="s-reveal" className={select} value={reveal} onChange={(e) => setReveal(e.target.value as typeof reveal)}>
              <option value="live">{t("settings.revealLive")}</option>
              <option value="next_morning">{t("settings.revealMorning")}</option>
            </select>
            {reveal === "next_morning" || shots ? (
              <Field id="s-reveal-at" type="datetime-local" label={t("settings.revealAt")} hint={t("settings.revealAtHint")} value={revealAt} onChange={(e) => setRevealAt(e.target.value)} />
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-bold">{t("settings.disposable")}</span>
            <Field id="s-shots" type="number" min={1} max={100} inputMode="numeric" label={t("settings.shots")} hint={t("settings.shotsHint")} value={shots} onChange={(e) => setShots(e.target.value)} />
          </div>
        </div>
        {saveBtn("uploads", () => save("uploads", {
          approvalMode: approval, revealMode: reveal,
          revealAt: fromLocalInput(revealAt), disposableShots: shots ? Math.max(1, Math.min(100, Number(shots))) : null,
        }))}
        {msg("uploads")}
      </Section>

      <Section id="pin" title={t("settings.pin")}>
        <p className="m-0 mb-4 text-sm text-muted">{o.hasPin ? t("settings.pinOn") : t("settings.pinOff")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field id="s-pin" className="w-48" label={t("settings.pinNew")} inputMode="numeric" pattern="\d{4,8}" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          <Button disabled={pin.length < 4 || saving === "pin"} onClick={() => save("pin", { pin }).then(() => setPin(""))}>{t("settings.pinSet")}</Button>
          {o.hasPin ? <Button variant="ghost" onClick={() => save("pin", { pin: null })}>{t("settings.pinRemove")}</Button> : null}
        </div>
        {msg("pin")}
      </Section>

      <Section id="share" title={t("share.title")}>
        <p className="m-0 mb-4 text-sm text-muted">{t("share.lead")}</p>
        <>
            <div className="flex flex-wrap items-end gap-3">
              <Field id="l-label" className="min-w-48 flex-1" label={t("share.label")} placeholder={t("share.labelPlaceholder")} value={linkLabel} maxLength={80} onChange={(e) => setLinkLabel(e.target.value)} />
              <div className="flex flex-col gap-2">
                <label htmlFor="l-scope" className="text-[13px] font-semibold text-text-2">{t("share.scope")}</label>
                <select id="l-scope" className={select} value={linkScope} onChange={(e) => setLinkScope(e.target.value as typeof linkScope)}>
                  <option value="view">{t("share.view")}</option>
                  <option value="view_upload">{t("share.viewUpload")}</option>
                </select>
              </div>
              <Button onClick={createLink}>{t("share.create")}</Button>
            </div>
            <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
              {(links || []).map((l) => (
                <li key={l.id} className="flex flex-col gap-3 rounded-2xl bg-tint p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-extrabold">{l.label || t("share.untitled")} <span className="text-sm font-semibold text-muted">· {l.scope === "view" ? t("share.view") : t("share.viewUpload")}{l.expiresAt ? ` · ${t("share.until", { date: formatDate(l.expiresAt, locale) })}` : ""}</span></span>
                    <button type="button" onClick={() => revokeLink(l.id)} className="min-h-11 text-sm font-bold text-[#8A1C1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">{t("share.revoke")}</button>
                  </div>
                  <code className="break-all text-sm">{l.url}</code>
                  <ShareButtons url={l.url} text={t("share.familyMessage", { title: o.title })} title={o.title} labels={shareLabels} />
                </li>
              ))}
              {links && !links.length ? <li className="text-sm text-muted">{t("share.none")}</li> : null}
            </ul>
        </>
        {msg("share")}
      </Section>

      <Section id="team" title={t("team.title")}>
        <p className="m-0 mb-4 text-sm text-muted">{t("team.lead")}</p>
        <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          {team?.members.map((mb) => (
            <li key={mb.hostId} className="flex items-center justify-between gap-3 rounded-2xl bg-tint px-4 py-3">
              <span className="min-w-0 truncate"><strong>{mb.name || mb.email}</strong> <span className="text-sm text-muted">· {mb.role === "owner" ? t("team.owner") : t("team.cohost")}</span></span>
              {isOwner && mb.role !== "owner" ? <button type="button" className="min-h-11 text-sm font-bold text-[#8A1C1C]" onClick={() => removeMember(`hostId=${mb.hostId}`)}>{t("team.remove")}</button> : null}
            </li>
          ))}
          {team?.invites.map((iv) => (
            <li key={iv.id} className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#C8CAD2] px-4 py-3">
              <span className="min-w-0 truncate">{iv.email} <span className="text-sm text-muted">· {t("team.pending")}</span></span>
              {isOwner ? <button type="button" className="min-h-11 text-sm font-bold text-[#8A1C1C]" onClick={() => removeMember(`inviteId=${iv.id}`)}>{t("team.cancelInvite")}</button> : null}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void invite(); }}>
            <Field id="t-email" type="email" required className="min-w-56 flex-1" label={t("team.email")} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <Button type="submit">{t("team.invite")}</Button>
          </form>
        ) : null}
        {msg("team")}
      </Section>

      {isOwner ? (
        <Section id="danger" title={t("danger.title")}>
          <p className="m-0 mb-4 text-sm text-muted">{t("danger.body")}</p>
          <Button variant="secondary" className="border-[#B42318]! text-[#B42318]! hover:bg-[#B42318]! hover:text-white!" disabled={saving === "danger"} onClick={destroy}><Trash2 size={18} aria-hidden />{t("danger.delete")}</Button>
          {msg("danger")}
        </Section>
      ) : null}
    </div>
  );
}

