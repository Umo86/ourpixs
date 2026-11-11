import {
  pgTable, uuid, text, timestamp, integer, boolean, pgEnum, primaryKey, index, uniqueIndex, date, bigint, jsonb,
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

/** Hosts = people who create events. Guests never get accounts. */
export const hosts = pgTable("hosts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  locale: text("locale").notNull().default("en"),
  brand: brandEnum("brand").notNull().default("ourpixs"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  ownerId: uuid("owner_id").notNull().references(() => hosts.id, { onDelete: "cascade" }),
  brand: brandEnum("brand").notNull().default("ourpixs"),
  type: occasionTypeEnum("type").notNull(),
  title: text("title").notNull(),
  honorees: text("honorees").array().notNull().default([]),
  startsOn: date("starts_on"),
  venueName: text("venue_name"),
  city: text("city"),
  theme: themeEnum("theme").notNull().default("noir"),
  plan: planEnum("plan").notNull().default("free"),
  uploadOpensAt: timestamp("upload_opens_at", { withTimezone: true }),
  uploadClosesAt: timestamp("upload_closes_at", { withTimezone: true }),
  revealMode: revealEnum("reveal_mode").notNull().default("live"),
  revealAt: timestamp("reveal_at", { withTimezone: true }),
  approvalMode: boolean("approval_mode").notNull().default(false),
  pinHash: text("pin_hash"),
  coverKey: text("cover_key"),
  disposableShots: integer("disposable_shots"),
  storageExpiresAt: timestamp("storage_expires_at", { withTimezone: true }),
  status: statusEnum("status").notNull().default("active"),
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
}, (t) => [index("days_occasion_idx").on(t.occasionId)]);

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  occasionId: uuid("occasion_id").notNull().references(() => occasions.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  deviceTokenHash: text("device_token_hash").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  shotsTaken: integer("shots_taken").notNull().default(0),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("media_occasion_created_idx").on(t.occasionId, t.createdAt),
  index("media_occasion_day_idx").on(t.occasionId, t.dayId),
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

/** Waitlist / contact / partner enquiries from the marketing site. */
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
