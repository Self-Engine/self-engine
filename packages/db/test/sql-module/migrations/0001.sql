CREATE TABLE sql_module_notes (id TEXT PRIMARY KEY, body TEXT NOT NULL) STRICT;

CREATE INDEX sql_module_notes_body ON sql_module_notes (body);
