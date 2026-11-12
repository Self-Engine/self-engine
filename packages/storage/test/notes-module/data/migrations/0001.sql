CREATE TABLE notes (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL,
  title TEXT NOT NULL,
  is_pinned INTEGER NOT NULL CHECK (is_pinned IN (0, 1))
) STRICT;

CREATE UNIQUE INDEX notes_live_title ON notes (space_id, title) WHERE deleted_at IS NULL;
