-- A running Timer (D310, D349): only its start is stored, on a whole second (D344), so nothing
-- writes while it runs. A stopped or discarded timer is a soft-deleted row. No unique index
-- limits the table to one timer: under sync two devices may each start one (D310).
CREATE TABLE timers (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
  started_at TEXT NOT NULL CHECK (substr(started_at, 20) = '.000Z'),
  project_id TEXT REFERENCES projects(id) DEFERRABLE INITIALLY DEFERRED,
  note TEXT
) STRICT;
CREATE INDEX timers_space ON timers (space_id);
-- The reference check looks a timer up by its project, in every Space (D337).
CREATE INDEX timers_project ON timers (project_id) WHERE deleted_at IS NULL;
-- The running timers, the most recently started first, without walking the soft-deleted runs.
CREATE INDEX timers_running ON timers (space_id, started_at) WHERE deleted_at IS NULL;
