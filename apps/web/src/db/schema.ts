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
/** Server-side copies (guest previews, watermarks, video transcodes): src/lib/media-processing.ts. */
export const processingStatusEnum = pgEnum("media_processing_status", ["pending", "ready", "failed"]);
export const visibilityEnum = pgEnum("visibility", ["visible", "hidden", "deleted"]);
export const shareScopeEnum = pgEnum("share_scope", ["view", "view_upload"]);
export const messageKindEnum = pgEnum("message_kind", ["text", "voice", "video"]);
/** LEGACY account subscription state (before the event package). Columns kept in the DB, no longer read or written. */
export const hostPlanStatusEnum = pgEnum("host_plan_status", ["none", "trialing", "active", "past_due", "cancelled", "expired"]);
export const planIntervalEnum = pgEnum("plan_interval", ["month", "year"]);
/**
 * Event package state (src/lib/access.ts derives the effective state from this plus the clock):
 *  setup    — not paid yet: the host configures the event and can test-upload; guests see "not open yet"
 *  paid     — paid; live while opens_at ≤ now < closes_at (access derives "live"/"ended" from the clock)
 *  live     — recorded state (optional; the clock decides)
 *  ended    — the gallery window is over (recorded by the cron / lazily, with the "download everything" email)
 *  expired  — past delete_after: files deleted by the cron
 *  refunded — refunded in full: read-only, guests can't open it
 */
export const packageStatusEnum = pgEnum("package_status", ["setup", "paid", "live", "ended", "expired", "refunded"]);

/** Hosts = people who create events. Guests never get accounts. */
export const hosts = pgTable("hosts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  locale: text("locale").notNull().default("en"),
  brand: brandEnum("brand").notNull().default("ourpixs"),
  stripeCustomerId: text("stripe_customer_id"),
  // ── LEGACY account subscription columns (replaced by the per-event package on `occasions`). ──
  // Kept in the DB on purpose (no destructive migration); nothing reads or writes them any more.
  planStatus: hostPlanStatusEnum("plan_status").notNull().default("none"),
  planInterval: planIntervalEnum("plan_interval"),
  /** LEGACY: start and end of the old account trial. */
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
  /** LEGACY complimentary access for the account subscription. No longer read: admins now mark single events as paid. */
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
  /** Legacy (one-off per-event plans). Kept in the DB, no longer used: access follows the event package below. */
  plan: planEnum("plan").notNull().default("free"),
  uploadOpensAt: timestamp("upload_opens_at", { withTimezone: true }),
  uploadClosesAt: timestamp("upload_closes_at", { withTimezone: true }),
  revealMode: revealEnum("reveal_mode").notNull().default("live"),
  revealAt: timestamp("reveal_at", { withTimezone: true }),
  approvalMode: boolean("approval_mode").notNull().default(false),
  pinHash: text("pin_hash"),
  coverKey: text("cover_key"),
  disposableShots: integer("disposable_shots"),
  /** Legacy per-event retention. No longer read: retention is `delete_after` below. */
  storageExpiresAt: timestamp("storage_expires_at", { withTimezone: true }),
  status: statusEnum("status").notNull().default("active"),
  /** Admin override: uploads closed and the event is read-only (src/lib/access.ts) until an admin reopens it. */
  adminLockedAt: timestamp("admin_locked_at", { withTimezone: true }),
  // ── Event package (src/lib/access.ts is the one place that interprets these). ──
  packageStatus: packageStatusEnum("package_status").notNull().default("setup"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  /** Set when an admin marked the event as paid without a payment (complimentary). */
  compedAt: timestamp("comped_at", { withTimezone: true }),
  /** The gallery window the organiser schedules (closes_at − opens_at ≤ settings.windowDays). */
  opensAt: timestamp("opens_at", { withTimezone: true }),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  /** IANA zone the window was entered in (shown to guests in that zone). */
  timeZone: text("time_zone").notNull().default("Europe/London"),
  /** closes_at + settings.retentionMonths, recorded at payment / window changes. Files are deleted after it. */
  deleteAfter: timestamp("delete_after", { withTimezone: true }),
  /** Once-only email markers. */
  endedEmailSentAt: timestamp("ended_email_sent_at", { withTimezone: true }),
  reminder30SentAt: timestamp("reminder_30_sent_at", { withTimezone: true }),
  reminder7SentAt: timestamp("reminder_7_sent_at", { withTimezone: true }),
  /** Set once when the event's storage first passes settings.fairUseGb (admins are emailed once). */
  fairUseAlertedAt: timestamp("fair_use_alerted_at", { withTimezone: true }),
  /** Latest Checkout session started for this event (an older open one is expired when a new one starts). */
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("occasions_owner_idx").on(t.ownerId),
  index("occasions_package_idx").on(t.packageStatus, t.closesAt),
  index("occasions_delete_after_idx").on(t.deleteAfter),
]);

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
  /**
   * Server-made copies (src/lib/media-processing.ts). Photos: key_display ≈2,000 px clean WebP (browser or server),
   * key_thumb ≈400 px clean, key_guest ≈1,200 px WATERMARKED, key_guest_thumb ≈400 px WATERMARKED.
   * Videos: key_display / key_thumb = clean poster, key_guest / key_guest_thumb = watermarked poster,
   * key_video = clean 1080p H.264 MP4, key_guest_video = 720p WATERMARKED MP4.
   * Guests only ever get the watermarked keys for other people's media; originals only via signed download links.
   */
  keyGuest: text("key_guest"),
  keyGuestThumb: text("key_guest_thumb"),
  keyVideo: text("key_video"),
  keyGuestVideo: text("key_guest_video"),
  processingStatus: processingStatusEnum("processing_status").notNull().default("pending"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  processingError: text("processing_error"),
  processingAttempts: integer("processing_attempts").notNull().default(0),
  /** Lease: set when a worker claims the item; another worker may take over after a few minutes. */
  processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
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
  index("media_processing_idx").on(t.processingStatus, t.processingStartedAt),
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

/**
 * Payments. kind "event_package" = the host's £69 package (one Stripe Checkout session per row);
 * guests buying all photos are in `guest_purchases` (no host account). Old rows with a `plan` are legacy one-off orders.
 * status: "paid" | "refunded" | "duplicate" (paid for an event that was already paid: refund by hand).
 */
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  hostId: uuid("host_id").notNull().references(() => hosts.id),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  /** Legacy (per-event plans before subscriptions); null for event packages. */
  plan: planEnum("plan"),
  kind: text("kind").notNull().default("event_package"),
  amountPence: integer("amount_pence").notNull(),
  currency: text("currency").notNull().default("gbp"),
  status: text("status").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  /** Stripe livemode: false for test-mode payments. */
  livemode: boolean("livemode").notNull().default(false),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("orders_payment_intent_idx").on(t.stripePaymentIntentId), index("orders_occasion_idx").on(t.occasionId)]);

/**
 * Guests buying "download everything" for an event (Stripe Checkout, mode payment, price = settings.guestDownloadPence).
 * status: "pending" (checkout started) | "paid" | "refunded". Only a hash of the emailed download token is stored;
 * the token (and the purchase) is valid until token_expires_at = paid_at + 30 days. Logic: src/lib/guest-purchase.ts.
 */
export const guestPurchases = pgTable("guest_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "set null" }),
  /** Filled from Stripe Checkout once paid. */
  email: text("email"),
  amountPence: integer("amount_pence").notNull(),
  currency: text("currency").notNull().default("gbp"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  downloadTokenHash: text("download_token_hash"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  /** When the download-link email went out (claimed before sending; cleared again if sending fails). */
  emailedAt: timestamp("emailed_at", { withTimezone: true }),
  locale: text("locale").notNull().default("en"),
  brand: brandEnum("brand").notNull().default("bizimresimler"),
  livemode: boolean("livemode").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("guest_purchases_occasion_idx").on(t.occasionId),
  index("guest_purchases_guest_idx").on(t.guestId),
  index("guest_purchases_pi_idx").on(t.stripePaymentIntentId),
  uniqueIndex("guest_purchases_token_idx").on(t.downloadTokenHash),
]);

/** Admin-editable settings (/admin/settings). Missing keys fall back to PACKAGE_DEFAULTS in src/lib/config.ts. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => hosts.id, { onDelete: "set null" }),
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
