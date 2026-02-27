CREATE TABLE IF NOT EXISTS person_pages (
  person_slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  status_code INTEGER,
  fetched_at TEXT NOT NULL,
  title TEXT,
  description TEXT,
  excerpt TEXT,
  content_text TEXT,
  content_hash TEXT,
  word_count INTEGER,
  reading_minutes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_person_pages_fetched_at
  ON person_pages(fetched_at DESC);
