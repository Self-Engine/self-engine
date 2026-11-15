-- No unique index on the title: two projects may carry the same one (D328).
CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  archived_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT
) STRICT;
