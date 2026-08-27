import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const localeEnum = pgEnum("locale", ["en", "ja"]);
export const answerLanguageModeEnum = pgEnum("answer_language_mode", ["interface", "source"]);
export const fetchStatusEnum = pgEnum("fetch_status", ["pending", "success", "error"]);
export const readLaterStatusEnum = pgEnum("read_later_status", [
  "inbox",
  "snoozed",
  "read",
  "archived",
]);
export const askRoleEnum = pgEnum("ask_role", ["user", "assistant"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: varchar("clerk_id", { length: 191 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  displayName: varchar("display_name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  interfaceLocale: localeEnum("interface_locale").notNull().default("en"),
  answerLanguageMode: answerLanguageModeEnum("answer_language_mode").notNull().default("interface"),
  notifyReadLaterDigest: boolean("notify_read_later_digest").notNull().default(true),
  notifyWeeklyStats: boolean("notify_weekly_stats").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedUrls = pgTable(
  "saved_urls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    domain: varchar("domain", { length: 255 }),
    title: text("title"),
    description: text("description"),
    faviconUrl: text("favicon_url"),
    ogImageUrl: text("og_image_url"),
    summary: text("summary"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    extractedText: text("extracted_text"),
    contentLanguage: varchar("content_language", { length: 8 }),
    estimatedReadMinutes: integer("estimated_read_minutes"),
    fetchStatus: fetchStatusEnum("fetch_status").notNull().default("pending"),
    fetchError: text("fetch_error"),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("saved_urls_user_normalized_unique").on(table.userId, table.normalizedUrl),
    index("saved_urls_user_id_idx").on(table.userId),
    index("saved_urls_search_vector_idx").using("gin", table.searchVector),
    index("saved_urls_tags_idx").using("gin", table.tags),
  ]
);

export const readLaterState = pgTable(
  "read_later_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    savedUrlId: uuid("saved_url_id")
      .notNull()
      .references(() => savedUrls.id, { onDelete: "cascade" }),
    status: readLaterStatusEnum("status").notNull().default("inbox"),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    markedReadAt: timestamp("marked_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("read_later_user_saved_url_unique").on(table.userId, table.savedUrlId),
    index("read_later_user_status_idx").on(table.userId, table.status),
  ]
);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 32 }),
    summary: text("summary"),
    summaryUpdatedAt: timestamp("summary_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("collections_user_id_idx").on(table.userId)]
);

export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    savedUrlId: uuid("saved_url_id")
      .notNull()
      .references(() => savedUrls.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("collection_items_collection_saved_url_unique").on(table.collectionId, table.savedUrlId),
  ]
);

export const askThreads = pgTable(
  "ask_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ask_threads_user_id_idx").on(table.userId)]
);

export const askMessages = pgTable(
  "ask_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => askThreads.id, { onDelete: "cascade" }),
    role: askRoleEnum("role").notNull(),
    content: text("content").notNull(),
    modelId: varchar("model_id", { length: 255 }),
    usedFallback: boolean("used_fallback").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ask_messages_thread_id_idx").on(table.threadId)]
);

export const askMessageCitations = pgTable(
  "ask_message_citations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => askMessages.id, { onDelete: "cascade" }),
    savedUrlId: uuid("saved_url_id")
      .notNull()
      .references(() => savedUrls.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    snippet: text("snippet"),
  },
  (table) => [index("ask_citations_message_id_idx").on(table.messageId)]
);

export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
  savedUrls: many(savedUrls),
  collections: many(collections),
  askThreads: many(askThreads),
}));

export const savedUrlsRelations = relations(savedUrls, ({ one, many }) => ({
  user: one(users, { fields: [savedUrls.userId], references: [users.id] }),
  readLaterState: one(readLaterState, {
    fields: [savedUrls.id],
    references: [readLaterState.savedUrlId],
  }),
  collectionItems: many(collectionItems),
}));

export const readLaterStateRelations = relations(readLaterState, ({ one }) => ({
  user: one(users, { fields: [readLaterState.userId], references: [users.id] }),
  savedUrl: one(savedUrls, {
    fields: [readLaterState.savedUrlId],
    references: [savedUrls.id],
  }),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(users, { fields: [collections.userId], references: [users.id] }),
  items: many(collectionItems),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionItems.collectionId],
    references: [collections.id],
  }),
  savedUrl: one(savedUrls, {
    fields: [collectionItems.savedUrlId],
    references: [savedUrls.id],
  }),
}));

export const askThreadsRelations = relations(askThreads, ({ one, many }) => ({
  user: one(users, { fields: [askThreads.userId], references: [users.id] }),
  messages: many(askMessages),
}));

export const askMessagesRelations = relations(askMessages, ({ one, many }) => ({
  thread: one(askThreads, {
    fields: [askMessages.threadId],
    references: [askThreads.id],
  }),
  citations: many(askMessageCitations),
}));

export const askMessageCitationsRelations = relations(askMessageCitations, ({ one }) => ({
  message: one(askMessages, {
    fields: [askMessageCitations.messageId],
    references: [askMessages.id],
  }),
  savedUrl: one(savedUrls, {
    fields: [askMessageCitations.savedUrlId],
    references: [savedUrls.id],
  }),
}));

// Re-exported for the hand-written search-vector migration (see
// src/db/migrations/0001_search_vector.sql) — kept here so schema.ts stays
// the single source of truth for column names the trigger references.
export const searchVectorSourceColumns = sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', array_to_string(coalesce(tags, ARRAY[]::text[]), ' ')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(extracted_text, '')), 'C')`;
