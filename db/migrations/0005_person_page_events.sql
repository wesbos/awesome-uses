CREATE TABLE IF NOT EXISTS person_page_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_slug TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  fetched_at TEXT NOT NULL,
  content_hash TEXT,
  change_type TEXT NOT NULL,
  title TEXT
);

CREATE INDEX IF NOT EXISTS idx_person_page_events_person_fetched
  ON person_page_events(person_slug, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_person_page_events_change_type_fetched
  ON person_page_events(change_type, fetched_at DESC);
