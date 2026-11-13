CREATE TABLE note_links (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  note_id TEXT NOT NULL REFERENCES notes(id),
  label TEXT NOT NULL
) STRICT;
CREATE INDEX note_links_space ON note_links (space_id);
