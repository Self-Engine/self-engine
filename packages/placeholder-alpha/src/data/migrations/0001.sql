CREATE TABLE placeholder_alpha_entries (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL,
  name TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX placeholder_alpha_entries_live_name
  ON placeholder_alpha_entries (space_id, name) WHERE deleted_at IS NULL;
