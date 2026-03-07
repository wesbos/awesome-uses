CREATE TABLE IF NOT EXISTS amazon_item_cache (
  item_key TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_amazon_item_cache_expires_at
  ON amazon_item_cache(expires_at);
