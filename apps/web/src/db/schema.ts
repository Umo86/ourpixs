import {
  pgTable, uuid, text, timestamp, integer, boolean, pgEnum, primaryKey, index, uniqueIndex, date, bigint, jsonb, real,
} from "drizzle-orm/pg-core";

export const brandEnum = pgEnum("brand", ["ourpixs", "bizimresimler"]);
export const planEnum = pgEnum("plan", ["free", "tek", "buyuk"]);
export const themeEnum = pgEnum("theme", ["noir", "royal", "ivory", "dusk", "mono", "blush"]);
export const occasionTypeEnum = pgEnum("occasion_type", [
  "dugun", "nisan", "kina", "sunnet", "dogum_gunu", "bebek", "mezuniyet", "yildonumu", "ev_partisi", "kurumsal", "diger",
]);
export const statusEnum = pgEnum("occasion_status", ["draft", "active", "archived"]);
export const revealEnum = pgEnum("reveal_mode", ["live", "next_morning"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "cohost"]);
export const mediaKindEnum = pgEnum("media_kind", ["photo", "video", "voice"]);
export const mediaStatusEnum = pgEnum("media_status", ["pending", "uploaded", "failed"]);
export const visibilityEnum = pgEnum("visibility", ["visible", "hidden", "deleted"]);
export const shareScopeEnum = pgEnum("share_scope", ["view", "view_upload"]);
export const messageKindEnum = pgEnum("message_kind", ["text", "voice", "video"]);
/** Account subscription state (see src/lib/access.ts). "none" = no trial yet (it starts with the first event). */
export const hostPlanStatusEnum = pgEnum("host_plan_status", ["none", "trialing", "active", "past_due", "cancelled", "expired"]);
export const planIntervalEnum = pgEnum("plan_interval", ["month", "year"]);

/** Hosts = people who create events. Guests never get accounts. */
export const hosts = pgTable("hosts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  locale: text("locale").notNull().default("en"),
  brand: brandEnum("brand").notNull().default("ourpixs"),
  stripeCustomerId: text("stripe_customer_id"),
  // ── Account subscription (Monthly / Yearly). Access rules live in src/lib/access.ts. ──
  planStatus: hostPlanStatusEnum("plan_status").notNull().default("none"),
  planInterval: planIntervalEnum("plan_interval"),
  /** Set when the host creates their first event; the free trial runs until trialEndsAt. */
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  /** First failed payment; past_due behaves as cancelled once the grace period has passed. */
  pastDueSince: timestamp("past_due_since", { withTimezone: true }),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  /** When the account's events became read-only (trial ended unpaid / paid period ended). */
  readOnlySince: timestamp("read_only_since", { withTimezone: true }),
  /** When the account's files will be deleted (null while trialing/active). */
  deleteAfter: timestamp("delete_after", { withTimezone: true }),
  /** Once-only email markers. */
  trialPromptSentAt: timestamp("trial_prompt_sent_at", { withTimezone: true }),
  trialEndEmailSentAt: timestamp("trial_end_email_sent_at", { withTimezone: true }),
  deletionWarningSentAt: timestamp("deletion_warning_sent_at", { withTimezone: true }),
  // ── Admin overrides (see src/lib/access.ts and /admin). ──
  /** Complimentary access: while comp_until > now the account has full active access, and the crons never end or delete it. */
  compUntil: timestamp("comp_until", { withTimezone: true }),
  /** Suspended accounts can't sign in or use the API; their events are read-only for guests. */
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedReason: text("suspended_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("hosts_plan_status_idx").on(t.planStatus), index("hosts_stripe_customer_idx").on(t.stripeCustomerId),
  index("hosts_created_idx").on(t.createdAt),
]);

/** One-time email sign-in codes / magic links (web + mobile share this). */
export const loginTokens = pgTable("login_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("login_tokens_email_idx").on(t.email)]);

/** Device push tokens for the Expo app. */
export const pushTokens = pgTable("push_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostId: uuid("host_id").notNull().references(() => hosts.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const occasions = pgTable("occasions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  /** Host-chosen custom link name (a–z, 0–9, hyphens). /g/[slug] resolves either this or `slug`. */
  vanitySlug: text("vanity_slug").unique(),
  ownerId: uuid("owner_id").notNull().references(() => hosts.id, { onDelete: "cascade" }),
  brand: brandEnum("brand").notNull().default("ourpixs"),
  type: occasionTypeEnum("type").notNull(),
  title: text("title").notNull(),
  honorees: text("honorees").array().notNull().default([]),
  startsOn: date("starts_on"),
  venueName: text("venue_name"),
  city: text("city"),
  theme: themeEnum("theme").notNull().default("noir"),
  /** Legacy (one-off per-event plans). Kept in the DB, no longer used for features: access follows the owner's subscription. */
  plan: planEnum("plan").notNull().default("free"),
  uploadOpensAt: timestamp("upload_opens_at", { withTimezone: true }),
  uploadClosesAt: timestamp("upload_closes_at", { withTimezone: true }),
  revealMode: revealEnum("reveal_mode").notNull().default("live"),
  revealAt: timestamp("reveal_at", { withTimezone: true }),
  approvalMode: boolean("approval_mode").notNull().default(false),
  pinHash: text("pin_hash"),
  coverKey: text("cover_key"),
  disposableShots: integer("disposable_shots"),
  /** Legacy per-event retention. No longer read: retention follows the owner's account (hosts.delete_after). */
  storageExpiresAt: timestamp("storage_expires_at", { withTimezone: true }),
  status: statusEnum("status").notNull().default("active"),
  /** Admin override: uploads closed and the event is read-only (src/lib/access.ts) until an admin reopens it. */
  adminLockedAt: timestamp("admin_locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("occasions_owner_idx").on(t.ownerId)]);

export const occasionMembers = pgTable("occasion_members", {
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  hostId: uuid("host_id").notNull().references(() => hosts.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").notNull().default("cohost"),
}, (t) => [primaryKey({ columns: [t.occasionId, t.hostId] })]);

export const cohostInvites = pgTable("cohost_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sub-days of an occasion (e.g. Kına, Düğün). Every occasion has at least one. */
export const days = pgTable("days", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  date: date("date"),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Optional per-day upload window (used by the per-day QR links). */
  uploadOpensAt: timestamp("upload_opens_at", { withTimezone: true }),
  uploadClosesAt: timestamp("upload_closes_at", { withTimezone: true }),
}, (t) => [index("days_occasion_idx").on(t.occasionId)]);

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  deviceTokenHash: text("device_token_hash").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  shotsTaken: integer("shots_taken").notNull().default(0),
  /** Set when a host blocks this guest: their media is hidden and the device can't upload again. */
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("guests_occasion_idx").on(t.occasionId), uniqueIndex("guests_device_idx").on(t.occasionId, t.deviceTokenHash)]);

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  dayId: uuid("day_id").references(() => days.id, { onDelete: "set null" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "set null" }),
  uploadedByHostId: uuid("uploaded_by_host_id").references(() => hosts.id, { onDelete: "set null" }),
  missionId: uuid("mission_id"),
  kind: mediaKindEnum("kind").notNull(),
  keyOriginal: text("key_original").notNull(),
  keyDisplay: text("key_display"),
  keyThumb: text("key_thumb"),
  mime: text("mime").notNull(),
  bytes: bigint("bytes", { mode: "number" }).notNull(),
  width: integer("width"),
  height: integer("height"),
  durationS: integer("duration_s"),
  momentTag: text("moment_tag"),
  fromDisposable: boolean("from_disposable").notNull().default(false),
  status: mediaStatusEnum("status").notNull().default("pending"),
  visibility: visibilityEnum("visibility").notNull().default("visible"),
  approved: boolean("approved").notNull().default(true),
  favourite: boolean("favourite").notNull().default(false),
  reactionCount: integer("reaction_count").notNull().default(0),
  /** 64-bit dHash of the thumbnail (16 hex chars), computed in the browser. */
  phash: text("phash"),
  /** Variance of Laplacian on a downscaled greyscale image; low = blurry. */
  blurScore: real("blur_score"),
  /** Auto-moderation flags: "duplicate", "blurry", "nsfw". Never auto-deletes. */
  moderationFlags: text("moderation_flags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("media_occasion_created_idx").on(t.occasionId, t.createdAt),
  index("media_occasion_day_idx").on(t.occasionId, t.dayId),
  index("media_created_idx").on(t.createdAt),
]);

export const reactions = pgTable("reactions", {
  mediaId: uuid("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
  guestId: uuid("guest_id").notNull().references(() => guests.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.mediaId, t.guestId] })]);

/** Photo missions / challenges set by the host. */
export const missions = pgTable("missions", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("missions_occasion_idx").on(t.occasionId)]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "set null" }),
  kind: messageKindEnum("kind").notNull().default("text"),
  body: text("body"),
  mediaKey: text("media_key"),
  durationS: integer("duration_s"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("messages_occasion_idx").on(t.occasionId)]);

export const shareLinks = pgTable("share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  scope: shareScopeEnum("scope").notNull().default("view"),
  label: text("label"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Legacy one-off per-event orders (before account subscriptions). Kept for records; no longer written. */
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  hostId: uuid("host_id").notNull().references(() => hosts.id),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  plan: planEnum("plan").notNull(),
  amountPence: integer("amount_pence").notNull(),
  currency: text("currency").notNull().default("gbp"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Postgres-backed token bucket for rate limiting. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  tokens: integer("tokens").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Waitlist / contact enquiries from the marketing site. */
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  data: jsonb("data"),
  /** Set by an admin once the enquiry has been dealt with (/admin/enquiries). */
  handledAt: timestamp("handled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Guest reports ("report this photo"), one row per report. Resolved by an admin from /admin/moderation. */
export const mediaReports = pgTable("media_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  mediaId: uuid("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "set null" }),
  reason: text("reason"),
  /** HMAC of the reporter's IP (never the IP itself). */
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => hosts.id, { onDelete: "set null" }),
}, (t) => [index("media_reports_media_idx").on(t.mediaId), index("media_reports_open_idx").on(t.resolvedAt, t.createdAt)]);

/** Every mutating admin action (/admin). Never updated or deleted by the app. */
export const adminAudit = pgTable("admin_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminHostId: uuid("admin_host_id").references(() => hosts.id, { onDelete: "set null" }),
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("admin_audit_created_idx").on(t.createdAt),
  index("admin_audit_target_idx").on(t.targetType, t.targetId),
  index("admin_audit_action_idx").on(t.action),
]);

/** One row per cron run (scheduled or "Run now" from /admin/system). */
export const cronRuns = pgTable("cron_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok"),
  summary: jsonb("summary"),
}, (t) => [index("cron_runs_name_idx").on(t.name, t.startedAt)]);
