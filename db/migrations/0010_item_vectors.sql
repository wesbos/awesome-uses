CREATE TABLE IF NOT EXISTS item_vectors (
  item_slug TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  embedding TEXT NOT NULL,
  embedded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
