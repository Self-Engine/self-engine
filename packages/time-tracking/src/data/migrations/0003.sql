-- A Time Entry in the decided shape (ADR 0044): its Measured Time, its Rounded Time, its Booked
-- Duration and the Rounding Rule that made them, and its projects as Project Shares. The stored
-- entries of the earlier shape are dropped; `timers` stays as it is, so a running Timer survives.
-- Startup takes a Backup before this runs.
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
  note TEXT,
  -- The name of the Time Zone the row was made in, as the Operation computed with it (D353).
  time_zone TEXT NOT NULL,
  -- Instants of the supported years compare as text in time order.
  CHECK (ended_at > started_at),
  CHECK ((rounded_started_at IS NULL) = (rounded_ended_at IS NULL)),
  CHECK (rounded_ended_at > rounded_started_at),
  CHECK (rounded_started_at IS NOT NULL OR booked_duration = 0)
) STRICT;
CREATE INDEX time_entries_space ON time_entries (space_id);
-- The window of a Day Span (D343) is read on the measured columns, a little wider than the span,
-- and cut on the Rounded Time afterwards. The end index keeps recent windows from walking the
-- older entries that end before them.
CREATE INDEX time_entries_ended ON time_entries (space_id, ended_at) WHERE deleted_at IS NULL;
-- The Project Shares (ADR 0044): one row per project of an entry, a Part Row of its entry, so it is
-- live only while the entry is (ADR 0042). Its place in the entry's list (the Lead Project at 0),
-- the Weight the user stated and the Project Share the Operation computed from it, in seconds. A
-- soft delete of a share means its project was removed from the entry. A project stands in a live
-- entry once; the Operation keeps that, and two devices may still each add one (read leniently).
CREATE TABLE project_shares (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  time_entry_id TEXT NOT NULL REFERENCES time_entries(id) DEFERRABLE INITIALLY DEFERRED,
  project_id TEXT NOT NULL REFERENCES projects(id) DEFERRABLE INITIALLY DEFERRED,
  place INTEGER NOT NULL CHECK (place >= 0),
  weight INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 10000),
  project_share INTEGER NOT NULL CHECK (project_share >= 0)
) STRICT;
-- The shares of a span's entries are read by their entry, in one read.
CREATE INDEX project_shares_entry ON project_shares (time_entry_id, place) WHERE deleted_at IS NULL;
-- The reference check looks a share up by its project, in every Space (D337).
CREATE INDEX project_shares_project ON project_shares (project_id) WHERE deleted_at IS NULL;
-- The Rounding Rules (ADR 0044, D309): a project's rules are Part Rows of their project, and the
-- app-wide rule names no project. A rule holds for every entry that starts at or after "holds
-- from"; a rule without one holds from the beginning. The rule is JSON text in the entry's form.
CREATE TABLE rounding_rules (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  project_id TEXT REFERENCES projects(id) DEFERRABLE INITIALLY DEFERRED,
  holds_from TEXT,
  rounding_rule TEXT NOT NULL CHECK (json_valid(rounding_rule))
) STRICT;
-- The lookup of a write walks the rules of one project, or the app-wide ones, by "holds from".
CREATE INDEX rounding_rules_space ON rounding_rules (space_id, project_id, holds_from)
  WHERE deleted_at IS NULL;
-- The frame looks the rules up by their project, in every Space (D337, ADR 0042).
CREATE INDEX rounding_rules_project ON rounding_rules (project_id) WHERE deleted_at IS NULL;
