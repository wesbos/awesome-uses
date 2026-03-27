CREATE TABLE IF NOT EXISTS tag_vectors (
  tag_slug TEXT PRIMARY KEY,
  tag_name TEXT NOT NULL,
  embedding TEXT NOT NULL,
  embedded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
