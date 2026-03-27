CREATE TABLE awards (
  award_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  data_json TEXT NOT NULL,
  calculated_at TEXT NOT NULL
);
