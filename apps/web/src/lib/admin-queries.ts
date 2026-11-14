import "server-only";
import { and, asc, desc, eq, ilike, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { computeAccess, packageStateSql, type Access } from "./access";
import { getSettings } from "./settings";
import { signMany } from "./storage";
import { likePattern, PAGE } from "./admin";

/**
 * Read-only queries behind /admin. Lists are paginated (PAGE = 50, one extra row tells us whether there is a next page)
 * and aggregate with sub-queries in the same statement, so a page is a fixed number of round-trips.
 */

const { hosts, occasions, media, guests, leads, adminAudit, cronRuns, occasionMembers, days, orders } = schema;

/** Start of today in London (events and uploads are counted by UK calendar day). */
const londonMidnight = sql`(date_trunc('day', now() at time zone 'Europe/London') at time zone 'Europe/London')`;
const int = (v: unknown) => Number(v ?? 0);

export const USER_FILTERS = ["paying", "suspended"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];
/** Event list filters: effective package states, plus admin overrides and the fair-use flag. */
export const EVENT_FILTERS = ["setup", "paid", "live", "ended", "expired", "refunded", "locked", "fair_use", "archived"] as const;
export type EventFilter = (typeof EVENT_FILTERS)[number];
export const PACKAGE_STATES = ["setup", "paid", "live", "ended", "expired", "refunded"] as const;
export const MEDIA_FILTERS = ["all", "visible", "hidden", "pending", "flagged"] as const;
export type MediaFilter = (typeof MEDIA_FILTERS)[number];
export const ENQUIRY_FILTERS = ["open", "handled", "all"] as const;
export type EnquiryFilter = (typeof ENQUIRY_FILTERS)[number];

/** Columns access.ts needs from an event. */
const packageCols = {
  packageStatus: occasions.packageStatus, opensAt: occasions.opensAt, closesAt: occasions.closesAt, deleteAfter: occasions.deleteAfter,
  adminLockedAt: occasions.adminLockedAt, compedAt: occasions.compedAt, paidAt: occasions.paidAt,
};
/** Paid event-package orders (refunds and duplicates excluded). */
const paidOrder = and(eq(orders.kind, "event_package"), eq(orders.status, "paid"));

function paged<T>(rows: T[], page: number) {
  return { rows: rows.slice(0, PAGE), page, hasNext: rows.length > PAGE };
}
const offsetOf = (page: number) => (page - 1) * PAGE;

// ── Moderation queue definition (shared by the overview count and /admin/moderation) ──────────────

const openReportExists = sql`exists(select 1 from media_reports r where r.media_id = ${media.id} and r.resolved_at is null)`;
/**
 * In the queue: visible, uploaded media that a guest reported (open report), or that auto-moderation held back
 * (approved = false with a flag, e.g. "nsfw"; also older reports from before media_reports existed).
 * Approving, hiding, deleting or blocking the guest takes an item out of the queue.
 */
export const moderationWhere = and(
  eq(media.status, "uploaded"), eq(media.visibility, "visible"),
  or(openReportExists, and(eq(media.approved, false), sql`cardinality(${media.moderationFlags}) > 0`)),
)!;

// ── Overview ───────────────────────────────────────────────────────────────────────────────────────

export async function overviewStats() {
  const settings = await getSettings();
  const state = packageStateSql(settings.retentionMonths);
  const [[h], [e], [m], [mod], [enq], [pay]] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      new7: sql<number>`(count(*) filter (where ${hosts.createdAt} >= now() - interval '7 days'))::int`,
      new30: sql<number>`(count(*) filter (where ${hosts.createdAt} >= now() - interval '30 days'))::int`,
      suspended: sql<number>`(count(*) filter (where ${hosts.suspendedAt} is not null))::int`,
    }).from(hosts),
    db.select({
      total: sql<number>`count(*)::int`,
      new7: sql<number>`(count(*) filter (where ${occasions.createdAt} >= now() - interval '7 days'))::int`,
      setup: sql<number>`(count(*) filter (where ${state} = 'setup'))::int`,
      paid: sql<number>`(count(*) filter (where ${state} = 'paid'))::int`,
      live: sql<number>`(count(*) filter (where ${state} = 'live'))::int`,
      ended: sql<number>`(count(*) filter (where ${state} = 'ended'))::int`,
      expired: sql<number>`(count(*) filter (where ${state} = 'expired'))::int`,
      refunded: sql<number>`(count(*) filter (where ${state} = 'refunded'))::int`,
      fairUse: sql<number>`(count(*) filter (where ${occasions.fairUseAlertedAt} is not null and ${occasions.status} <> 'archived'))::int`,
    }).from(occasions),
    db.select({
      today: sql<number>`(count(*) filter (where ${media.createdAt} >= ${londonMidnight}))::int`,
      week: sql<number>`(count(*) filter (where ${media.createdAt} >= now() - interval '7 days'))::int`,
      bytes: sql<number>`coalesce(sum(${media.bytes}) filter (where ${media.visibility} <> 'deleted'), 0)::bigint`,
    }).from(media).where(eq(media.status, "uploaded")),
    db.select({ n: sql<number>`count(*)::int` }).from(media).where(moderationWhere),
    db.select({ n: sql<number>`count(*)::int` }).from(leads).where(isNull(leads.handledAt)),
    db.select({
      count: sql<number>`count(*)::int`,
      pence: sql<number>`coalesce(sum(${orders.amountPence}), 0)::bigint`,
      count30: sql<number>`(count(*) filter (where ${orders.paidAt} >= now() - interval '30 days'))::int`,
      pence30: sql<number>`coalesce(sum(${orders.amountPence}) filter (where ${orders.paidAt} >= now() - interval '30 days'), 0)::bigint`,
      testCount: sql<number>`(count(*) filter (where not ${orders.livemode}))::int`,
      refunded: sql<number>`(select count(*)::int from orders r where r.kind = 'event_package' and r.status = 'refunded')`,
      duplicates: sql<number>`(select count(*)::int from orders r where r.kind = 'event_package' and r.status = 'duplicate')`,
    }).from(orders).where(paidOrder),
  ]);
  return {
    hosts: { total: int(h?.total), new7: int(h?.new7), new30: int(h?.new30), suspended: int(h?.suspended) },
    packages: {
      setup: int(e?.setup), paid: int(e?.paid), live: int(e?.live), ended: int(e?.ended), expired: int(e?.expired), refunded: int(e?.refunded),
    },
    revenue: {
      count: int(pay?.count), pence: int(pay?.pence), count30: int(pay?.count30), pence30: int(pay?.pence30), testCount: int(pay?.testCount),
      refunded: int(pay?.refunded), duplicates: int(pay?.duplicates),
    },
    events: { total: int(e?.total), new7: int(e?.new7), fairUse: int(e?.fairUse) },
    uploads: { today: int(m?.today), week: int(m?.week), bytes: int(m?.bytes) },
    moderationOpen: int(mod?.n),
    enquiriesOpen: int(enq?.n),
    retentionMonths: settings.retentionMonths,
  };
}

/** The last `n` London calendar days as YYYY-MM-DD, oldest first. */
function lastDays(n: number): string[] {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const base = new Date(`${today}T12:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => new Date(base - (n - 1 - i) * 86400_000).toISOString().slice(0, 10));
}

/** Sign-ups and uploads per London day for the last 30 days (gaps filled with 0). */
export async function dailySeries(n = 30) {
  const hostDay = sql<string>`to_char(${hosts.createdAt} at time zone 'Europe/London', 'YYYY-MM-DD')`;
  const mediaDay = sql<string>`to_char(${media.createdAt} at time zone 'Europe/London', 'YYYY-MM-DD')`;
  const since = sql`now() - make_interval(days => ${n + 1}::int)`;
  const [signups, uploads] = await Promise.all([
    db.select({ day: hostDay, n: sql<number>`count(*)::int` }).from(hosts).where(sql`${hosts.createdAt} >= ${since}`).groupBy(hostDay),
    db.select({ day: mediaDay, n: sql<number>`count(*)::int` }).from(media).where(and(eq(media.status, "uploaded"), sql`${media.createdAt} >= ${since}`)).groupBy(mediaDay),
  ]);
  const s = new Map(signups.map((r) => [r.day, int(r.n)]));
  const u = new Map(uploads.map((r) => [r.day, int(r.n)]));
  return lastDays(n).map((day) => ({ day, signups: s.get(day) ?? 0, uploads: u.get(day) ?? 0 }));
}

// ── Users ──────────────────────────────────────────────────────────────────────────────────────────

const hostEventCount = sql<number>`(select count(*)::int from occasions o where o.owner_id = ${hosts.id})`;
const hostStorage = sql<number>`(select coalesce(sum(m.bytes), 0)::bigint from media m inner join occasions o on o.id = m.occasion_id
  where o.owner_id = ${hosts.id} and m.status = 'uploaded' and m.visibility <> 'deleted')`;

const hostPaidEvents = sql<number>`(select count(*)::int from occasions o where o.owner_id = ${hosts.id} and o.package_status in ('paid', 'live', 'ended', 'expired'))`;

function userFilterSql(f: UserFilter): SQL {
  if (f === "suspended") return sql`${hosts.suspendedAt} is not null`;
  return sql`exists(select 1 from occasions o where o.owner_id = ${hosts.id} and o.package_status in ('paid', 'live', 'ended'))`;
}

export async function listUsers(opts: { q: string; filter: UserFilter | null; page: number }) {
  const where: SQL[] = [];
  if (opts.q) where.push(or(ilike(hosts.email, likePattern(opts.q)), ilike(hosts.name, likePattern(opts.q)))!);
  if (opts.filter) where.push(userFilterSql(opts.filter));
  const rows = await db.select({
    id: hosts.id, email: hosts.email, name: hosts.name, brand: hosts.brand, locale: hosts.locale, createdAt: hosts.createdAt,
    suspendedAt: hosts.suspendedAt, events: hostEventCount, paidEvents: hostPaidEvents, bytes: hostStorage,
  }).from(hosts).where(where.length ? and(...where) : undefined)
    .orderBy(desc(hosts.createdAt), desc(hosts.id)).limit(PAGE + 1).offset(offsetOf(opts.page));
  return paged(rows.map((r) => ({ ...r, events: int(r.events), paidEvents: int(r.paidEvents), bytes: int(r.bytes) })), opts.page);
}

export async function userDetail(id: string) {
  const [host] = await db.select().from(hosts).where(eq(hosts.id, id)).limit(1);
  if (!host) return null;
  const [owned, cohosted, auditRows] = await Promise.all([
    db.select({
      id: occasions.id, title: occasions.title, type: occasions.type, slug: occasions.slug, status: occasions.status,
      startsOn: occasions.startsOn, createdAt: occasions.createdAt, ...packageCols, fairUseAlertedAt: occasions.fairUseAlertedAt,
      mediaCount: sql<number>`(select count(*)::int from media m where m.occasion_id = ${occasions.id} and m.status = 'uploaded' and m.visibility <> 'deleted')`,
      bytes: sql<number>`(select coalesce(sum(m.bytes), 0)::bigint from media m where m.occasion_id = ${occasions.id} and m.status = 'uploaded' and m.visibility <> 'deleted')`,
      guestCount: sql<number>`(select count(*)::int from guests g where g.occasion_id = ${occasions.id})`,
    }).from(occasions).where(eq(occasions.ownerId, id)).orderBy(desc(occasions.createdAt)).limit(PAGE),
    db.select({ id: occasions.id, title: occasions.title, status: occasions.status })
      .from(occasionMembers).innerJoin(occasions, eq(occasions.id, occasionMembers.occasionId))
      .where(and(eq(occasionMembers.hostId, id), eq(occasionMembers.role, "cohost"))).orderBy(desc(occasions.createdAt)).limit(PAGE),
    db.select().from(adminAudit).where(and(eq(adminAudit.targetType, "host"), eq(adminAudit.targetId, id))).orderBy(desc(adminAudit.createdAt)).limit(20),
  ]);
  const settings = await getSettings();
  const now = new Date();
  return {
    host,
    owned: owned.map((o) => ({ ...o, mediaCount: int(o.mediaCount), bytes: int(o.bytes), guestCount: int(o.guestCount), access: computeAccess(o, host, settings, now) })),
    cohosted, audit: auditRows,
  };
}

// ── Events ─────────────────────────────────────────────────────────────────────────────────────────

const occMediaCount = sql<number>`(select count(*)::int from media m where m.occasion_id = ${occasions.id} and m.status = 'uploaded' and m.visibility <> 'deleted')`;
const occStorage = sql<number>`(select coalesce(sum(m.bytes), 0)::bigint from media m where m.occasion_id = ${occasions.id} and m.status = 'uploaded' and m.visibility <> 'deleted')`;
const occGuests = sql<number>`(select count(*)::int from guests g where g.occasion_id = ${occasions.id})`;

function eventFilterSql(f: EventFilter, retentionMonths: number): SQL {
  if (f === "archived") return eq(occasions.status, "archived");
  if (f === "locked") return and(ne(occasions.status, "archived"), isNotNull(occasions.adminLockedAt))!;
  if (f === "fair_use") return isNotNull(occasions.fairUseAlertedAt);
  return sql`${packageStateSql(retentionMonths)} = ${f}`;
}

export async function listEvents(opts: { q: string; filter: EventFilter | null; page: number; ownerId?: string | null }) {
  const settings = await getSettings();
  const where: SQL[] = [];
  if (opts.q) {
    const p = likePattern(opts.q);
    where.push(or(ilike(occasions.title, p), ilike(occasions.slug, p), ilike(occasions.vanitySlug, p), ilike(hosts.email, p))!);
  }
  if (opts.filter) where.push(eventFilterSql(opts.filter, settings.retentionMonths));
  if (opts.ownerId) where.push(eq(occasions.ownerId, opts.ownerId));
  const rows = await db.select({
    id: occasions.id, title: occasions.title, type: occasions.type, slug: occasions.slug, status: occasions.status,
    startsOn: occasions.startsOn, createdAt: occasions.createdAt, ...packageCols, fairUseAlertedAt: occasions.fairUseAlertedAt,
    ownerId: occasions.ownerId, ownerEmail: hosts.email, ownerSuspendedAt: hosts.suspendedAt,
    guestCount: occGuests, mediaCount: occMediaCount, bytes: occStorage,
  }).from(occasions).innerJoin(hosts, eq(hosts.id, occasions.ownerId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(occasions.createdAt), desc(occasions.id)).limit(PAGE + 1).offset(offsetOf(opts.page));
  const now = new Date();
  return paged(rows.map((r) => ({
    ...r, guestCount: int(r.guestCount), mediaCount: int(r.mediaCount), bytes: int(r.bytes),
    access: computeAccess(r, { suspendedAt: r.ownerSuspendedAt }, settings, now),
  })), opts.page);
}

export type AdminMedia = {
  id: string; kind: "photo" | "video" | "voice"; thumbUrl: string | null; displayUrl: string | null; playbackUrl: string | null;
  visibility: string; approved: boolean; flags: string[]; guestId: string | null; guestName: string | null; createdAt: string;
  bytes: number; occasionId: string; occasionTitle?: string; reportCount?: number; reasons?: string[];
};

type MediaRowLite = { id: string; kind: "photo" | "video" | "voice"; keyOriginal: string; keyDisplay: string | null; keyThumb: string | null };

/** Signed thumb / display / playback URLs for admin viewing (admins can always view, whatever the download lock). */
async function signAdmin(rows: MediaRowLite[]) {
  const [thumbs, displays, originals] = await Promise.all([
    signMany(rows.map((r) => r.keyThumb ?? r.keyDisplay)),
    signMany(rows.map((r) => r.keyDisplay ?? r.keyThumb)),
    signMany(rows.map((r) => (r.kind === "video" || !r.keyDisplay ? r.keyOriginal : null))),
  ]);
  return rows.map((r, i) => ({
    thumbUrl: thumbs[i] ?? (r.kind === "photo" ? originals[i] : null) ?? null,
    displayUrl: displays[i] ?? (r.kind === "photo" ? originals[i] : null) ?? null,
    playbackUrl: r.kind === "video" ? originals[i] ?? null : null,
  }));
}

function mediaFilterSql(f: MediaFilter): SQL[] {
  if (f === "visible") return [eq(media.visibility, "visible")];
  if (f === "hidden") return [eq(media.visibility, "hidden")];
  if (f === "pending") return [eq(media.visibility, "visible"), eq(media.approved, false)];
  if (f === "flagged") return [sql`cardinality(${media.moderationFlags}) > 0`];
  return [];
}

export async function eventDetail(id: string, opts: { mediaPage: number; mediaFilter: MediaFilter; guestPage: number }) {
  const [row] = await db.select({ occasion: occasions, owner: hosts }).from(occasions)
    .innerJoin(hosts, eq(hosts.id, occasions.ownerId)).where(eq(occasions.id, id)).limit(1);
  if (!row) return null;
  const { occasion: o, owner } = row;
  const [dayRows, members, stats, mediaRows, guestRows, auditRows, orderRows, settings] = await Promise.all([
    db.select().from(days).where(eq(days.occasionId, id)).orderBy(asc(days.sortOrder)),
    db.select({ hostId: hosts.id, email: hosts.email, name: hosts.name, role: occasionMembers.role })
      .from(occasionMembers).innerJoin(hosts, eq(hosts.id, occasionMembers.hostId)).where(eq(occasionMembers.occasionId, id)).limit(PAGE),
    db.select({
      guests: occGuests, media: occMediaCount, bytes: occStorage,
      photos: sql<number>`(select count(*)::int from media m where m.occasion_id = ${occasions.id} and m.status = 'uploaded' and m.visibility <> 'deleted' and m.kind = 'photo')`,
      videos: sql<number>`(select count(*)::int from media m where m.occasion_id = ${occasions.id} and m.status = 'uploaded' and m.visibility <> 'deleted' and m.kind = 'video')`,
      hidden: sql<number>`(select count(*)::int from media m where m.occasion_id = ${occasions.id} and m.status = 'uploaded' and m.visibility = 'hidden')`,
      pending: sql<number>`(select count(*)::int from media m where m.occasion_id = ${occasions.id} and m.status = 'uploaded' and m.visibility = 'visible' and m.approved = false)`,
      messages: sql<number>`(select count(*)::int from messages x where x.occasion_id = ${occasions.id})`,
      openReports: sql<number>`(select count(*)::int from media_reports r where r.occasion_id = ${occasions.id} and r.resolved_at is null)`,
    }).from(occasions).where(eq(occasions.id, id)),
    db.select({ m: media, guestName: guests.displayName }).from(media).leftJoin(guests, eq(guests.id, media.guestId))
      .where(and(eq(media.occasionId, id), eq(media.status, "uploaded"), ne(media.visibility, "deleted"), ...mediaFilterSql(opts.mediaFilter)))
      .orderBy(desc(media.createdAt), desc(media.id)).limit(PAGE + 1).offset(offsetOf(opts.mediaPage)),
    db.select({
      id: guests.id, displayName: guests.displayName, createdAt: guests.createdAt, blockedAt: guests.blockedAt,
      uploads: sql<number>`(select count(*)::int from media m where m.guest_id = ${guests.id} and m.status = 'uploaded' and m.visibility <> 'deleted')`,
    }).from(guests).where(eq(guests.occasionId, id)).orderBy(desc(guests.createdAt), desc(guests.id)).limit(PAGE + 1).offset(offsetOf(opts.guestPage)),
    db.select().from(adminAudit).where(and(eq(adminAudit.targetType, "occasion"), eq(adminAudit.targetId, id))).orderBy(desc(adminAudit.createdAt)).limit(20),
    db.select().from(orders).where(eq(orders.occasionId, id)).orderBy(desc(orders.createdAt)).limit(20),
    getSettings(),
  ]);
  const mPage = paged(mediaRows, opts.mediaPage);
  const signed = await signAdmin(mPage.rows.map((r) => r.m));
  const items: AdminMedia[] = mPage.rows.map((r, i) => ({
    id: r.m.id, kind: r.m.kind, ...signed[i]!, visibility: r.m.visibility, approved: r.m.approved, flags: r.m.moderationFlags,
    guestId: r.m.guestId, guestName: r.guestName, createdAt: r.m.createdAt.toISOString(), bytes: r.m.bytes, occasionId: r.m.occasionId,
  }));
  const s = stats[0];
  return {
    occasion: o, owner, days: dayRows, members, orders: orderRows, settings,
    access: computeAccess(o, owner, settings),
    stats: {
      guests: int(s?.guests), media: int(s?.media), bytes: int(s?.bytes), photos: int(s?.photos), videos: int(s?.videos),
      hidden: int(s?.hidden), pending: int(s?.pending), messages: int(s?.messages), openReports: int(s?.openReports),
    },
    media: { items, page: mPage.page, hasNext: mPage.hasNext },
    guests: { ...paged(guestRows.map((g) => ({ ...g, uploads: int(g.uploads) })), opts.guestPage) },
    audit: auditRows,
  };
}

// ── Payments ───────────────────────────────────────────────────────────────────────────────────────

/** Latest event-package payments (all statuses), with the event and owner. */
export async function recentPayments(n = 20) {
  return db.select({
    id: orders.id, occasionId: orders.occasionId, title: occasions.title, email: hosts.email, amountPence: orders.amountPence,
    status: orders.status, livemode: orders.livemode, paidAt: orders.paidAt, createdAt: orders.createdAt, stripeSessionId: orders.stripeSessionId,
  }).from(orders).innerJoin(occasions, eq(occasions.id, orders.occasionId)).innerJoin(hosts, eq(hosts.id, orders.hostId))
    .where(eq(orders.kind, "event_package")).orderBy(desc(orders.createdAt)).limit(n);
}

// ── Moderation ─────────────────────────────────────────────────────────────────────────────────────

export async function moderationQueue(page: number) {
  const lastReport = sql<Date | null>`(select max(r.created_at) from media_reports r where r.media_id = ${media.id} and r.resolved_at is null)`;
  const rows = await db.select({
    m: media, guestName: guests.displayName, occasionTitle: occasions.title,
    reportCount: sql<number>`(select count(*)::int from media_reports r where r.media_id = ${media.id} and r.resolved_at is null)`,
    reasons: sql<string[] | null>`(select array_agg(x.reason) from (select r.reason from media_reports r
      where r.media_id = ${media.id} and r.resolved_at is null and r.reason is not null and r.reason <> '' order by r.created_at desc limit 5) x)`,
  }).from(media)
    .innerJoin(occasions, eq(occasions.id, media.occasionId))
    .leftJoin(guests, eq(guests.id, media.guestId))
    .where(moderationWhere)
    .orderBy(desc(sql`coalesce(${lastReport}, ${media.createdAt})`), desc(media.id))
    .limit(PAGE + 1).offset(offsetOf(page));
  const p = paged(rows, page);
  const signed = await signAdmin(p.rows.map((r) => r.m));
  const items: AdminMedia[] = p.rows.map((r, i) => ({
    id: r.m.id, kind: r.m.kind, ...signed[i]!, visibility: r.m.visibility, approved: r.m.approved, flags: r.m.moderationFlags,
    guestId: r.m.guestId, guestName: r.guestName, createdAt: r.m.createdAt.toISOString(), bytes: r.m.bytes,
    occasionId: r.m.occasionId, occasionTitle: r.occasionTitle, reportCount: int(r.reportCount), reasons: r.reasons ?? [],
  }));
  return { items, page: p.page, hasNext: p.hasNext };
}

// ── Enquiries ──────────────────────────────────────────────────────────────────────────────────────

export async function listEnquiries(opts: { q: string; filter: EnquiryFilter; page: number }) {
  const where: SQL[] = [];
  if (opts.filter === "open") where.push(isNull(leads.handledAt));
  if (opts.filter === "handled") where.push(isNotNull(leads.handledAt));
  if (opts.q) where.push(or(ilike(leads.email, likePattern(opts.q)), ilike(leads.name, likePattern(opts.q)), ilike(leads.kind, likePattern(opts.q)))!);
  const rows = await db.select().from(leads).where(where.length ? and(...where) : undefined)
    .orderBy(desc(leads.createdAt), desc(leads.id)).limit(PAGE + 1).offset(offsetOf(opts.page));
  return paged(rows, opts.page);
}

// ── Audit ──────────────────────────────────────────────────────────────────────────────────────────

export async function listAudit(opts: { action: string; admin: string; page: number }) {
  const where: SQL[] = [];
  if (opts.action) where.push(eq(adminAudit.action, opts.action));
  if (opts.admin) where.push(eq(adminAudit.adminEmail, opts.admin));
  const [rows, actions, admins] = await Promise.all([
    db.select().from(adminAudit).where(where.length ? and(...where) : undefined)
      .orderBy(desc(adminAudit.createdAt), desc(adminAudit.id)).limit(PAGE + 1).offset(offsetOf(opts.page)),
    db.selectDistinct({ v: adminAudit.action }).from(adminAudit).orderBy(asc(adminAudit.action)).limit(200),
    db.selectDistinct({ v: adminAudit.adminEmail }).from(adminAudit).orderBy(asc(adminAudit.adminEmail)).limit(200),
  ]);
  return { ...paged(rows, opts.page), actions: actions.map((a) => a.v), admins: admins.map((a) => a.v) };
}

// ── System ─────────────────────────────────────────────────────────────────────────────────────────

export async function recentCronRuns(name: string, n = 10) {
  return db.select().from(cronRuns).where(eq(cronRuns.name, name)).orderBy(desc(cronRuns.startedAt)).limit(n);
}

export type { Access };
