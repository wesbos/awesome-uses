CREATE TABLE IF NOT EXISTS items (
  item_slug TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  item_type TEXT,
  description TEXT,
  item_url TEXT,
  enriched_at TEXT
);
