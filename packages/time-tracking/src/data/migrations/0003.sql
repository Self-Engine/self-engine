-- A Time Entry in the decided shape (ADR 0044): its Measured Time, its Rounded Time, its Booked
-- Duration and the Rounding Rule that made them. The stored entries of the earlier shape are
-- dropped; `timers` stays as it is, so a running Timer survives. Startup takes a Backup before
-- this runs.
DROP TABLE time_entries;
CREATE TABLE time_entries (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  -- The Measured Time: as measured or entered, on whole seconds, never rounded (D308, D344).
  started_at TEXT NOT NULL CHECK (substr(started_at, 20) = '.000Z'),
  ended_at TEXT NOT NULL CHECK (substr(ended_at, 20) = '.000Z'),
  -- The Rounded Time: where the entry counts, both ends or neither.
  rounded_started_at TEXT CHECK (substr(rounded_started_at, 20) = '.000Z'),
  rounded_ended_at TEXT CHECK (substr(rounded_ended_at, 20) = '.000Z'),
  -- The Booked Duration in seconds; an entry without a Rounded Time counts nothing.
  booked_duration INTEGER NOT NULL CHECK (booked_duration >= 0),
  -- The Rounding Rule as JSON text, such as {"kind":"ordinary","direction":"up","minutes":1}. The
  -- database checks that it is readable; the code checks its content, in one place.
  rounding_rule TEXT NOT NULL CHECK (json_valid(rounding_rule)),
  rule_chosen_by_hand INTEGER NOT NULL CHECK (rule_chosen_by_hand IN (0, 1)),
  project_id TEXT REFERENCES projects(id) DEFERRABLE INITIALLY DEFERRED,
  note TEXT,
  -- The breaks inside the entry, a JSON array such as
  -- [{"timeKind":"rest_break","startedAt":"…","endedAt":"…","changedByLimit":false}]. The
  -- database checks that it is a readable array; the code checks its content, in one place.
  breaks TEXT NOT NULL CHECK (json_valid(breaks) AND json_type(breaks) = 'array'),
  -- The name of the Time Zone the row was made in, as the Operation computed with it (D353).
  time_zone TEXT NOT NULL,
  -- Instants of the supported years compare as text in time order.
  CHECK (ended_at > started_at),
  CHECK ((rounded_started_at IS NULL) = (rounded_ended_at IS NULL)),
  CHECK (rounded_ended_at > rounded_started_at),
  CHECK (rounded_started_at IS NOT NULL OR booked_duration = 0)
) STRICT;
CREATE INDEX time_entries_space ON time_entries (space_id);
-- The reference check looks an entry up by its project, in every Space (D337).
CREATE INDEX time_entries_project ON time_entries (project_id) WHERE deleted_at IS NULL;
-- The window of a Day Span (D343) is read on the measured columns, a little wider than the span,
-- and cut on the Rounded Time afterwards. The end index keeps recent windows from walking the
-- older entries that end before them.
CREATE INDEX time_entries_ended ON time_entries (space_id, ended_at) WHERE deleted_at IS NULL;
