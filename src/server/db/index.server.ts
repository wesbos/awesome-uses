export { resolveDb } from './connection.server';

export {
  parseTagsJson,
  uniqueSorted,
  buildExtractedIndexes,
  getAllExtractedRows,
  type AllItemRow,
  type ExtractedIndexes,
} from './helpers.server';

export {
  getScrapedProfileBySlug,
  getAllScrapeSummaries,
  upsertScrapedProfile,
  getScrapedContent,
  getErrorPeople,
  getAllScrapedPersonSlugs,
  markVectorized,
  getScrapedPagesForExtraction,
  getRandomScrapedPages,
  getProfilesForVectorization,
  type ScrapeChangeType,
  type ScrapedPageForExtraction,
  type ProfileForVectorization,
} from './profiles.server';

export {
  getAllTagSummaries,
  getTagDetailBySlug,
  getExtractedTags,
  getReclassifyCandidates,
  applyTagReclassification,
  type TagItemCount,
  type TagSummary,
  type TagDetail,
  type ReclassifyCandidate,
  type ReclassifyAssignment,
  type ReclassifyApplyResult,
} from './tags.server';

export {
  getPersonItems,
  getItemDetailBySlug,
  getItemDetailByName,
  searchItems,
  mergeItemsIntoCanonical,
  deletePersonItems,
  insertPersonItems,
  getAllUniqueItems,
  getItemsByPerson,
  findDuplicateItems,
  getExtractionReviewData,
  type ItemRelatedItem,
  type ItemTagRelation,
  type ItemDetail,
  type ItemSearchResult,
  type MergeItemsResult,
  type DuplicateGroup,
  type ExtractionReviewData,
} from './items.server';

export {
  getRecentScrapeEvents,
  getScrapeHistoryStats,
  getPersonScrapeHistory,
  type ScrapeEventRow,
  type ScrapeHistoryStats,
  type PersonScrapeHistoryRow,
} from './events.server';

export {
  getAmazonCacheByItemKey,
  upsertAmazonCache,
  type AmazonCacheRow,
} from './amazon-cache.server';

export {
  getItemEnrichment,
  upsertItemEnrichment,
  getAllItemEnrichments,
} from './enrichments.server';

export {
  upsertItemVector,
  getAllItemVectors,
  getItemVectorCount,
  getItemVectorSlugs,
  type ItemVector,
} from './item-vectors.server';
