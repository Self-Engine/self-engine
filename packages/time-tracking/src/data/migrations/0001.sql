-- A Time Entry (D308, D342, D344): where it lies, on whole seconds, and how much it counts. The
-- project is a column, as a module above may carry one for a module below (ADR 0014); `projects`
-- carries nothing for time entries.
CREATE TABLE time_entries (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  started_at TEXT NOT NULL CHECK (substr(started_at, 20) = '.000Z'),
  ended_at TEXT NOT NULL CHECK (substr(ended_at, 20) = '.000Z'),
  -- The Booked Duration: in layer 4 always end minus start; later rounding changes only it.
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  project_id TEXT REFERENCES projects(id) DEFERRABLE INITIALLY DEFERRED,
  note TEXT,
  -- The name of the Time Zone the row was made in, as the Operation computed with it (D353).
  time_zone TEXT NOT NULL,
  -- Instants of the supported years compare as text in time order.
  CHECK (ended_at > started_at)
) STRICT;
CREATE INDEX time_entries_space ON time_entries (space_id);
-- The reference check looks an entry up by its project, in every Space (D337).
CREATE INDEX time_entries_project ON time_entries (project_id) WHERE deleted_at IS NULL;
-- The window of a Day Span (D343): every Live Row that begins before its end and ends after its
-- start. The end index keeps recent windows from walking the older entries that end before them.
CREATE INDEX time_entries_ended ON time_entries (space_id, ended_at) WHERE deleted_at IS NULL;
