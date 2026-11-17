import { sql } from "drizzle-orm";
import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { Itinerary } from "@/lib/itinerary/schema";
import type { BlockedDate, Traveller } from "@/lib/validation";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stored lower-cased; uniqueness is therefore case-insensitive.
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt,
});

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the cookie token, so a database leak does not expose live sessions.
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginFailures = pgTable(
  "login_failures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    createdAt,
  },
  (t) => [index("login_failures_email_idx").on(t.email, t.createdAt)],
);

export const households = pgTable("households", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  homeCity: text("home_city").notNull(),
  travellers: jsonb("travellers").$type<Traveller[]>().notNull().default(sql`'[]'::jsonb`),
  pace: text("pace").notNull().default("balanced"),
  diet: text("diet").notNull().default("none"),
  dietNotes: text("diet_notes").notNull().default(""),
  accessibilityNotes: text("accessibility_notes").notNull().default(""),
  interests: jsonb("interests").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    destination: text("destination").notNull(),
    origin: text("origin").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    flexDays: integer("flex_days").notNull().default(0),
    blockedDates: jsonb("blocked_dates").$type<BlockedDate[]>().notNull().default(sql`'[]'::jsonb`),
    pendingDependencies: text("pending_dependencies").notNull().default(""),
    budgetInr: integer("budget_inr"),
    notes: text("notes").notNull().default(""),
    createdAt,
  },
  (t) => [index("trips_user_idx").on(t.userId, t.createdAt)],
);

export const itineraries = pgTable(
  "itineraries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    // Denormalised so every itinerary query can be scoped to its owner directly.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    // The trip dates this draft was written for; a mismatch means the draft is stale.
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    data: jsonb("data").$type<Itinerary>().notNull(),
    createdAt,
  },
  (t) => [
    index("itineraries_trip_idx").on(t.tripId, t.createdAt),
    index("itineraries_user_idx").on(t.userId, t.createdAt),
  ],
);

/** One row per metered action, used for per-user daily limits. */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt,
  },
  (t) => [index("usage_events_user_idx").on(t.userId, t.kind, t.createdAt)],
);

/** Cache of place-search results, shared by all users. Null coordinates mean "searched, not found". */
export const geocodes = pgTable("geocodes", {
  query: text("query").primaryKey(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdAt,
});

/** People who asked for school-holiday fare alerts. No account is needed to sign up. */
export const fareWatchSignups = pgTable("fare_watch_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  homeCity: text("home_city").notNull(),
  school: text("school").notNull(),
  board: text("board"),
  breaks: jsonb("breaks").$type<string[]>().notNull(),
  wishlist: jsonb("wishlist").$type<string[]>().notNull(),
  travellers: integer("travellers"),
  /** Travel windows the parent picked on the year calendar. Empty means "any time". */
  windows: jsonb("windows")
    .$type<{ id: string; label: string; start: string; end: string | null; kind: string }[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  // Random secret used in the unsubscribe link and in personal tracked links.
  token: text("token").notNull().unique(),
  createdAt,
});

/** A fare someone on the team saw, with where and when, and the link people are sent to. */
export const fareAlerts = pgTable("fare_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  // Older alerts were tagged with a school break; newer ones carry travel dates.
  breakLabel: text("break_label"),
  travelStart: date("travel_start", { mode: "string" }),
  travelEnd: date("travel_end", { mode: "string" }),
  priceInr: integer("price_inr").notNull(),
  seenOn: date("seen_on", { mode: "string" }).notNull(),
  source: text("source").notNull(),
  targetUrl: text("target_url").notNull(),
  createdAt,
});

export const fareAlertClicks = pgTable(
  "fare_alert_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => fareAlerts.id, { onDelete: "cascade" }),
    // Null when the link was opened without a personal token, or the person later unsubscribed.
    signupId: uuid("signup_id").references(() => fareWatchSignups.id, { onDelete: "set null" }),
    createdAt,
  },
  (t) => [index("fare_alert_clicks_alert_idx").on(t.alertId)],
);
