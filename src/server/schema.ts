import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const personPages = sqliteTable('person_pages', {
  personSlug: text('person_slug').primaryKey(),
  url: text('url').notNull(),
  statusCode: integer('status_code'),
  fetchedAt: text('fetched_at').notNull(),
  title: text('title'),
  contentMarkdown: text('content_markdown'),
  contentHash: text('content_hash'),
  vectorizedAt: text('vectorized_at'),
}, (table) => [
  index('idx_person_pages_fetched_at').on(table.fetchedAt),
]);

export const personItems = sqliteTable('person_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personSlug: text('person_slug').notNull(),
  item: text('item').notNull(),
  tagsJson: text('tags_json').notNull().default('[]'),
  detail: text('detail'),
  extractedAt: text('extracted_at').notNull(),
}, (table) => [
  uniqueIndex('person_items_person_slug_item_unique').on(table.personSlug, table.item),
  index('idx_person_items_person_slug').on(table.personSlug),
]);

export const personPageEvents = sqliteTable('person_page_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personSlug: text('person_slug').notNull(),
  url: text('url').notNull(),
  statusCode: integer('status_code'),
  fetchedAt: text('fetched_at').notNull(),
  contentHash: text('content_hash'),
  changeType: text('change_type').notNull(),
  title: text('title'),
}, (table) => [
  index('idx_person_page_events_person_fetched').on(table.personSlug, table.fetchedAt),
  index('idx_person_page_events_change_type_fetched').on(table.changeType, table.fetchedAt),
]);

export const amazonItemCache = sqliteTable('amazon_item_cache', {
  itemKey: text('item_key').primaryKey(),
  query: text('query').notNull(),
  marketplace: text('marketplace').notNull(),
  payloadJson: text('payload_json').notNull(),
  fetchedAt: text('fetched_at').notNull(),
  expiresAt: text('expires_at').notNull(),
}, (table) => [
  index('idx_amazon_item_cache_expires_at').on(table.expiresAt),
]);

export const items = sqliteTable('items', {
  itemSlug: text('item_slug').primaryKey(),
  itemName: text('item_name').notNull(),
  itemType: text('item_type'),
  description: text('description'),
  itemUrl: text('item_url'),
  enrichedAt: text('enriched_at'),
});

export const githubProfiles = sqliteTable('github_profiles', {
  personSlug: text('person_slug').primaryKey(),
  githubUsername: text('github_username').notNull(),
  dataJson: text('data_json').notNull(),
  fetchedAt: text('fetched_at').notNull(),
  expiresAt: text('expires_at').notNull(),
}, (table) => [
  index('idx_github_profiles_expires_at').on(table.expiresAt),
  index('idx_github_profiles_github_username').on(table.githubUsername),
]);

export const siteManagementVectors = sqliteTable('site_management_vectors', {
  personSlug: text('person_slug').primaryKey(),
  embeddingJson: text('embedding_json').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const itemVectors = sqliteTable('item_vectors', {
  itemSlug: text('item_slug').primaryKey(),
  itemName: text('item_name').notNull(),
  embedding: text('embedding').notNull(),
  embeddedAt: text('embedded_at').notNull(),
});

export const tagVectors = sqliteTable('tag_vectors', {
  tagSlug: text('tag_slug').primaryKey(),
  tagName: text('tag_name').notNull(),
  embedding: text('embedding').notNull(),
  embeddedAt: text('embedded_at').notNull(),
});

export const generatedAvatars = sqliteTable('generated_avatars', {
  personSlug: text('person_slug').primaryKey(),
  status: text('status').notNull().default('pending'), // pending | processing | completed | failed | skipped_no_source
  batchId: text('batch_id'),
  gridPosition: integer('grid_position'), // 0-8 position in 3x3 grid
  generatedAt: text('generated_at'),
  error: text('error'),
}, (table) => [
  index('idx_generated_avatars_status').on(table.status),
  index('idx_generated_avatars_batch_id').on(table.batchId),
]);

export const awards = sqliteTable('awards', {
  awardKey: text('award_key').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  dataJson: text('data_json').notNull(),
  calculatedAt: text('calculated_at').notNull(),
});
