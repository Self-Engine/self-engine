CREATE TABLE baskets (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  title TEXT NOT NULL
) STRICT;
CREATE INDEX baskets_space ON baskets (space_id);
-- Part Rows of a basket: each belongs to its basket and refers to a note.
CREATE TABLE basket_items (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  basket_id TEXT NOT NULL REFERENCES baskets(id) DEFERRABLE INITIALLY DEFERRED,
  note_id TEXT NOT NULL REFERENCES notes(id) DEFERRABLE INITIALLY DEFERRED
) STRICT;
CREATE INDEX basket_items_basket ON basket_items (basket_id) WHERE deleted_at IS NULL;
CREATE INDEX basket_items_note ON basket_items (note_id) WHERE deleted_at IS NULL;
-- Part Rows of a note, a row of another module that learns nothing of them.
CREATE TABLE note_marks (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  note_id TEXT NOT NULL REFERENCES notes(id) DEFERRABLE INITIALLY DEFERRED,
  label TEXT NOT NULL
) STRICT;
CREATE INDEX note_marks_space ON note_marks (space_id);
CREATE INDEX note_marks_note ON note_marks (note_id) WHERE deleted_at IS NULL;
