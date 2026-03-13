CREATE TABLE IF NOT EXISTS person_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_slug TEXT NOT NULL,
  item TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  detail TEXT,
  extracted_at TEXT NOT NULL,
  UNIQUE(person_slug, item)
);

CREATE INDEX IF NOT EXISTS idx_person_items_person_slug
  ON person_items(person_slug);
