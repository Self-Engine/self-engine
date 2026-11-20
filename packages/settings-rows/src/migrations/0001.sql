CREATE TABLE settings (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  key TEXT NOT NULL,
  value TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX settings_live_key ON settings (space_id, key) WHERE deleted_at IS NULL;
