-- Every row belongs to a Space the database knows (D286). SQLite cannot add a foreign key to a
-- table, so the table is created again; its rows in dev databases are dropped with it, since no
-- stable release has shipped it (D252).
DROP TABLE placeholder_alpha_entries;

CREATE TABLE placeholder_alpha_entries (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  name TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX placeholder_alpha_entries_live_name
  ON placeholder_alpha_entries (space_id, name) WHERE deleted_at IS NULL;
