-- The reference check looks a link up by its note, in every Space (D337).
CREATE INDEX note_links_note ON note_links (note_id) WHERE deleted_at IS NULL;
