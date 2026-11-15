CREATE TABLE project_entries (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  project_id TEXT NOT NULL REFERENCES projects(id),
  label TEXT NOT NULL
) STRICT;
CREATE INDEX project_entries_space ON project_entries (space_id);
