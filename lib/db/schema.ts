import type { InferModel } from "drizzle-orm"
import { pgTable, serial, text, timestamp, boolean, json, integer, pgEnum } from "drizzle-orm/pg-core"

// Enums
export const platformEnum = pgEnum("platform", [
  "facebook",
  "google",
  "instagram",
  "linkedin",
  "twitter",
  "tiktok",
  "other",
])

export const adTypeEnum = pgEnum("ad_type", ["image", "video", "text", "carousel", "other"])

export const alertTypeEnum = pgEnum("alert_type", [
  "new_campaign",
  "ad_change",
  "spend_increase",
  "spend_decrease",
  "new_platform",
  "other",
])

// Tables
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID as primary key
  email: text("email"),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").default("dark"),
  emailNotifications: boolean("email_notifications").default(true),
  inAppNotifications: boolean("in_app_notifications").default(true),
  scrapingFrequency: integer("scraping_frequency").default(12), // in hours
  dataRetentionDays: integer("data_retention_days").default(90),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Businesses are now directly linked to users (not through a separate businesses table)
export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  location: text("location"),
  keywords: text("keywords").notNull(),
  knownCompetitors: text("known_competitors"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const competitors = pgTable("competitors", {
  id: serial("id").primaryKey(),
  userId: text("user_id") // Direct link to user
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  website: text("website").notNull(),
  industry: text("industry").notNull(),
  notes: text("notes"),
  // New fields for enhanced competitor information
  description: text("description"),
  products: text("products"),
  targetAudience: text("target_audience"),
  uniqueSellingProposition: text("unique_selling_proposition"),
  // Tracking preferences
  trackFacebook: boolean("track_facebook").default(true).notNull(),
  trackGoogle: boolean("track_google").default(true).notNull(),
  trackInstagram: boolean("track_instagram").default(true).notNull(),
  trackLinkedIn: boolean("track_linkedin").default(false).notNull(),
  lastScraped: timestamp("last_scraped"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  userId: text("user_id") // Direct link to user
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  competitorId: integer("competitor_id")
    .notNull()
    .references(() => competitors.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  type: adTypeEnum("type").notNull(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  landingPage: text("landing_page"),
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  aiAnalysis: json("ai_analysis"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: text("user_id") // Direct link to user
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  competitorId: integer("competitor_id")
    .notNull()
    .references(() => competitors.id, { onDelete: "cascade" }),
  type: alertTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  isImportant: boolean("is_important").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const insights = pgTable("insights", {
  id: serial("id").primaryKey(),
  userId: text("user_id") // Direct link to user
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation").notNull(),
  isApplied: boolean("is_applied").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// Types
export type User = InferModel<typeof users>
export type UserPreferences = InferModel<typeof userPreferences>
export type Business = InferModel<typeof businesses>
export type Competitor = InferModel<typeof competitors>
export type Ad = InferModel<typeof ads>
export type Alert = InferModel<typeof alerts>
export type Insight = InferModel<typeof insights>