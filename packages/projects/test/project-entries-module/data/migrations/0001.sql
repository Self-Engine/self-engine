CREATE TABLE project_entries (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  project_id TEXT NOT NULL REFERENCES projects(id) DEFERRABLE INITIALLY DEFERRED,
  label TEXT NOT NULL
) STRICT;
CREATE INDEX project_entries_space ON project_entries (space_id);
-- The reference check looks an entry up by its project, in every Space (D337).
CREATE INDEX project_entries_project ON project_entries (project_id) WHERE deleted_at IS NULL;
