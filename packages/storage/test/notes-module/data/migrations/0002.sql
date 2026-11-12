CREATE INDEX notes_live_created_id ON notes (space_id, created_at, id) WHERE deleted_at IS NULL;
