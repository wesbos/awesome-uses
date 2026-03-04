CREATE TABLE IF NOT EXISTS person_pages (
  person_slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  status_code INTEGER,
  fetched_at TEXT NOT NULL,
  title TEXT,
  content_markdown TEXT,
  content_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_person_pages_fetched_at
  ON person_pages(fetched_at DESC);
