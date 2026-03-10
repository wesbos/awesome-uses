CREATE TABLE IF NOT EXISTS github_profiles (
  person_slug TEXT PRIMARY KEY,
  github_username TEXT NOT NULL,
  data_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_github_profiles_expires_at ON github_profiles(expires_at);
CREATE INDEX IF NOT EXISTS idx_github_profiles_github_username ON github_profiles(github_username);
