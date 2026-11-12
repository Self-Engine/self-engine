import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { openDatabase } from "../better-sqlite3/index.ts";
import { createMigrationRunner } from "../core/index.ts";
import type { Database } from "../core/index.ts";
import { checkConventions } from "./index.ts";

const SYNCED_COLUMNS = `
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  space_id TEXT NOT NULL
`;

let database: Database;

beforeEach(() => {
  database = openDatabase(":memory:");
});

afterEach(async () => {
  await database.close();
});

describe("checkConventions", () => {
  test("reports a table that is not STRICT", async () => {
    await database.executeScript(`CREATE TABLE notes (${SYNCED_COLUMNS});`);

    await expect(checkConventions(database)).resolves.toEqual([
      { table: "notes", rule: "must be STRICT" },
    ]);
  });

  test("reports nothing for a good table", async () => {
    await database.executeScript(`CREATE TABLE notes (${SYNCED_COLUMNS}) STRICT;`);

    await expect(checkConventions(database)).resolves.toEqual([]);
  });

  test("skips Kysely's two tables and SQLite's internal tables", async () => {
    await createMigrationRunner(database, [
      {
        name: "test/0001",
        sql: `
          CREATE TABLE local_counters (n INTEGER PRIMARY KEY AUTOINCREMENT) STRICT;
          INSERT INTO local_counters DEFAULT VALUES;
          CREATE INDEX local_counters_n ON local_counters (n);
          ANALYZE;
        `,
      },
    ]).run();

    await expect(checkConventions(database)).resolves.toEqual([]);
  });

  test("holds a table to the rules when its name only resembles a skipped one", async () => {
    await database.executeScript(`CREATE TABLE kysely_migration_notes (${SYNCED_COLUMNS});`);

    await expect(checkConventions(database)).resolves.toEqual([
      { table: "kysely_migration_notes", rule: "must be STRICT" },
    ]);
  });

  test("does not take a view for a table", async () => {
    await database.executeScript("CREATE VIEW numbers AS SELECT 1 AS n;");

    await expect(checkConventions(database)).resolves.toEqual([]);
  });

  test("holds a virtual table to STRICT too, since there is no list of exceptions", async () => {
    await database.executeScript("CREATE VIRTUAL TABLE local_search USING fts5(body);");

    await expect(checkConventions(database)).resolves.toContainEqual({
      table: "local_search",
      rule: "must be STRICT",
    });
  });

  describe("indexes", () => {
    test.each([
      ["a plain index", "CREATE INDEX notes_created ON notes (space_id, created_at)"],
      [
        "a live unique index",
        "CREATE UNIQUE INDEX notes_created ON notes (space_id, created_at) WHERE deleted_at IS NULL",
      ],
      [
        "quoted names and comments",
        'CREATE UNIQUE INDEX "WHERE" ON notes ("SPACE_ID", created_at) where (("DELETED_AT") is /* live */ null)',
      ],
      [
        "bracketed names",
        "CREATE UNIQUE INDEX notes_created ON notes ([space_id], created_at) WHERE [deleted_at] IS NULL",
      ],
      [
        "backtick names",
        "CREATE UNIQUE INDEX notes_created ON notes (`space_id`, created_at) WHERE `deleted_at` IS NULL",
      ],
    ])("accepts %s", async (_name, definition) => {
      await database.executeScript(`
        CREATE TABLE notes (${SYNCED_COLUMNS}) STRICT;
        ${definition};
      `);

      await expect(checkConventions(database)).resolves.toEqual([]);
    });

    test.each([
      ["another predicate", "created_at IS NOT NULL"],
      ["a misleading comment", "created_at IS NOT NULL /* deleted_at IS NULL */"],
      ["a string", "'deleted_at IS NULL'"],
      ["a quoted string instead of a column", "'deleted_at' IS NULL"],
      ["deleted rows included by OR", "deleted_at IS NULL OR created_at IS NOT NULL"],
    ])("reports a unique index with %s", async (_name, predicate) => {
      await database.executeScript(`
        CREATE TABLE notes (${SYNCED_COLUMNS}) STRICT;
        CREATE UNIQUE INDEX notes_created ON notes (space_id, created_at) WHERE ${predicate};
      `);

      await expect(checkConventions(database)).resolves.toEqual([
        {
          table: "notes",
          rule: "unique index notes_created must be partial on deleted_at IS NULL",
        },
      ]);
    });

    test("reports an expression before space_id", async () => {
      await database.executeScript(`
        CREATE TABLE notes (${SYNCED_COLUMNS}) STRICT;
        CREATE INDEX notes_created ON notes (lower(created_at), space_id);
      `);

      await expect(checkConventions(database)).resolves.toEqual([
        { table: "notes", rule: "index notes_created must start with space_id" },
      ]);
    });

    test("reports both broken rules on one unique index", async () => {
      await database.executeScript(`
        CREATE TABLE notes (${SYNCED_COLUMNS}) STRICT;
        CREATE UNIQUE INDEX notes_created ON notes (created_at);
      `);

      await expect(checkConventions(database)).resolves.toEqual([
        {
          table: "notes",
          rule: "unique index notes_created must be partial on deleted_at IS NULL",
        },
        { table: "notes", rule: "index notes_created must start with space_id" },
      ]);
    });

    test("allows any indexes and inline UNIQUE on a Local Table", async () => {
      await database.executeScript(`
        CREATE TABLE local_figures (id TEXT PRIMARY KEY, total INTEGER UNIQUE) STRICT;
        CREATE INDEX local_total ON local_figures (total);
        CREATE UNIQUE INDEX local_id ON local_figures (id);
        CREATE UNIQUE INDEX local_positive ON local_figures (total) WHERE total > 0;
      `);

      await expect(checkConventions(database)).resolves.toEqual([]);
    });

    test("does not read inline UNIQUE from comments, strings or quoted names", async () => {
      await database.executeScript(`
        CREATE TABLE notes (
          ${SYNCED_COLUMNS},
          "UNIQUE" TEXT DEFAULT 'UNIQUE',
          body TEXT /* UNIQUE */ -- UNIQUE
        ) STRICT;
      `);

      await expect(checkConventions(database)).resolves.toEqual([]);
    });

    test.each([
      ["a column constraint", "body TEXT UNIQUE"],
      ["a table constraint", "body TEXT, UNIQUE (space_id, body)"],
      ["a redundant constraint on the primary key", "UNIQUE (id)"],
    ])("reports inline UNIQUE as %s", async (_name, definition) => {
      await database.executeScript(`
        CREATE TABLE notes (${SYNCED_COLUMNS}, ${definition}) STRICT;
      `);

      await expect(checkConventions(database)).resolves.toEqual([
        {
          table: "notes",
          rule: "must not have an inline UNIQUE constraint; use a partial unique index starting with space_id WHERE deleted_at IS NULL",
        },
      ]);
    });

    test("reports a unique index that includes deleted rows", async () => {
      await database.executeScript(`
        CREATE TABLE notes (${SYNCED_COLUMNS}) STRICT;
        CREATE UNIQUE INDEX notes_created ON notes (space_id, created_at);
      `);

      await expect(checkConventions(database)).resolves.toEqual([
        {
          table: "notes",
          rule: "unique index notes_created must be partial on deleted_at IS NULL",
        },
      ]);
    });

    test("reports an index that does not start with space_id", async () => {
      await database.executeScript(`
        CREATE TABLE notes (${SYNCED_COLUMNS}) STRICT;
        CREATE INDEX notes_created ON notes (created_at, space_id);
      `);

      await expect(checkConventions(database)).resolves.toEqual([
        { table: "notes", rule: "index notes_created must start with space_id" },
      ]);
    });
  });

  describe("the required columns", () => {
    const ID_RULE = "must have id as its TEXT primary key";
    const CREATED_RULE = "must have created_at as non-null TEXT";
    const UPDATED_RULE = "must have updated_at as non-null TEXT";
    const DELETED_RULE = "must have deleted_at as nullable TEXT";
    const SPACE_RULE = "must have space_id as non-null TEXT";

    test.each([
      [
        "id is missing",
        "note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, space_id TEXT NOT NULL",
        ID_RULE,
      ],
      [
        "id is not TEXT",
        "id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, space_id TEXT NOT NULL",
        ID_RULE,
      ],
      [
        "id is not the primary key",
        "id TEXT, created_at TEXT PRIMARY KEY NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, space_id TEXT NOT NULL",
        ID_RULE,
      ],
      [
        "id is only part of the primary key",
        "id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, space_id TEXT NOT NULL, PRIMARY KEY (id, space_id)",
        ID_RULE,
      ],
      [
        "created_at is missing",
        "id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, deleted_at TEXT, space_id TEXT NOT NULL",
        CREATED_RULE,
      ],
      [
        "created_at is not TEXT",
        "id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, space_id TEXT NOT NULL",
        CREATED_RULE,
      ],
      [
        "created_at is nullable",
        "id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT NOT NULL, deleted_at TEXT, space_id TEXT NOT NULL",
        CREATED_RULE,
      ],
      [
        "updated_at is missing",
        "id TEXT PRIMARY KEY, created_at TEXT NOT NULL, deleted_at TEXT, space_id TEXT NOT NULL",
        UPDATED_RULE,
      ],
      [
        "updated_at is nullable",
        "id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT, deleted_at TEXT, space_id TEXT NOT NULL",
        UPDATED_RULE,
      ],
      [
        "deleted_at is missing",
        "id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, space_id TEXT NOT NULL",
        DELETED_RULE,
      ],
      [
        "deleted_at is non-null",
        "id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NOT NULL, space_id TEXT NOT NULL",
        DELETED_RULE,
      ],
      [
        "deleted_at is not TEXT",
        "id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at INTEGER, space_id TEXT NOT NULL",
        DELETED_RULE,
      ],
      [
        "space_id is missing",
        "id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT",
        SPACE_RULE,
      ],
      [
        "space_id is nullable",
        "id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, space_id TEXT",
        SPACE_RULE,
      ],
    ])("reports a table where %s", async (_name, columns, rule) => {
      await database.executeScript(`CREATE TABLE notes (${columns}) STRICT;`);

      await expect(checkConventions(database)).resolves.toEqual([{ table: "notes", rule }]);
    });

    test("accepts a column type written in lower case", async () => {
      await database.executeScript(
        "CREATE TABLE notes (id text PRIMARY KEY, created_at text NOT NULL, updated_at text NOT NULL, deleted_at text, space_id text NOT NULL) STRICT;",
      );

      await expect(checkConventions(database)).resolves.toEqual([]);
    });

    test("does not ask them of a Local Table", async () => {
      await database.executeScript("CREATE TABLE local_figures (total INTEGER) STRICT;");

      await expect(checkConventions(database)).resolves.toEqual([]);
    });

    test("asks them of a table whose prefix is in another case", async () => {
      await database.executeScript("CREATE TABLE LOCAL_figures (total INTEGER) STRICT;");

      await expect(checkConventions(database)).resolves.toEqual([
        { table: "LOCAL_figures", rule: ID_RULE },
        { table: "LOCAL_figures", rule: CREATED_RULE },
        { table: "LOCAL_figures", rule: UPDATED_RULE },
        { table: "LOCAL_figures", rule: DELETED_RULE },
        { table: "LOCAL_figures", rule: SPACE_RULE },
      ]);
    });

    test("still asks a Local Table to be STRICT", async () => {
      await database.executeScript("CREATE TABLE local_figures (total INTEGER);");

      await expect(checkConventions(database)).resolves.toEqual([
        { table: "local_figures", rule: "must be STRICT" },
      ]);
    });
  });

  describe("a timestamp column", () => {
    test.each([
      [
        "created_at",
        "created_at TEXT NOT NULL DEFAULT 'x', updated_at TEXT NOT NULL, deleted_at TEXT",
      ],
      [
        "updated_at",
        "created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT 'x', deleted_at TEXT",
      ],
      [
        "deleted_at",
        "created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT DEFAULT 'x'",
      ],
    ])("reports an SQL DEFAULT on %s", async (column, timestamps) => {
      await database.executeScript(
        `CREATE TABLE notes (id TEXT PRIMARY KEY, ${timestamps}, space_id TEXT NOT NULL) STRICT;`,
      );

      await expect(checkConventions(database)).resolves.toEqual([
        { table: "notes", rule: `must not have an SQL DEFAULT on ${column}` },
      ]);
    });

    test("reports an SQL DEFAULT on a Local Table too", async () => {
      await database.executeScript(
        "CREATE TABLE local_figures (created_at TEXT DEFAULT CURRENT_TIMESTAMP) STRICT;",
      );

      await expect(checkConventions(database)).resolves.toEqual([
        { table: "local_figures", rule: "must not have an SQL DEFAULT on created_at" },
      ]);
    });

    test("leaves a DEFAULT on any other column alone", async () => {
      await database.executeScript(
        `CREATE TABLE notes (${SYNCED_COLUMNS}, body TEXT NOT NULL DEFAULT '') STRICT;`,
      );

      await expect(checkConventions(database)).resolves.toEqual([]);
    });
  });

  describe("a foreign key", () => {
    const NOT_DEFERRED = {
      table: "notes",
      rule: "foreign key to projects must be DEFERRABLE INITIALLY DEFERRED",
    };

    test.each([
      ["no deferral clause", "project_id TEXT REFERENCES projects (id)"],
      ["NOT DEFERRABLE", "project_id TEXT REFERENCES projects (id) NOT DEFERRABLE"],
      ["only DEFERRABLE", "project_id TEXT REFERENCES projects (id) DEFERRABLE"],
      [
        "INITIALLY IMMEDIATE",
        "project_id TEXT REFERENCES projects (id) DEFERRABLE INITIALLY IMMEDIATE",
      ],
      ["another constraint after it", "project_id TEXT REFERENCES projects (id) NOT NULL"],
      ["no parent columns", "project_id TEXT REFERENCES projects"],
      ["only actions", "project_id TEXT REFERENCES projects (id) ON DELETE CASCADE"],
      [
        "a table constraint without deferral",
        "project_id TEXT, FOREIGN KEY (project_id) REFERENCES projects (id)",
      ],
      [
        "deferral text that sits only in a comment",
        "project_id TEXT REFERENCES projects (id) /* DEFERRABLE INITIALLY DEFERRED */",
      ],
    ])("reports %s", async (_name, definition) => {
      await database.executeScript(`CREATE TABLE notes (${SYNCED_COLUMNS}, ${definition}) STRICT;`);

      await expect(checkConventions(database)).resolves.toEqual([NOT_DEFERRED]);
    });

    test.each([
      [
        "a deferred column",
        "project_id TEXT REFERENCES projects (id) DEFERRABLE INITIALLY DEFERRED",
      ],
      ["no parent columns", "project_id TEXT REFERENCES projects DEFERRABLE INITIALLY DEFERRED"],
      ["lower case", "project_id TEXT references projects (id) deferrable initially deferred"],
      [
        "actions before the deferral",
        "project_id TEXT REFERENCES projects (id) ON DELETE SET NULL ON UPDATE NO ACTION MATCH FULL DEFERRABLE INITIALLY DEFERRED",
      ],
      [
        "a deferred table constraint",
        "project_id TEXT, FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED",
      ],
      [
        "a comment inside the clause",
        "project_id TEXT REFERENCES projects (id) /* why */ DEFERRABLE -- note\n INITIALLY DEFERRED",
      ],
      [
        "a deferral after a later column constraint",
        "project_id TEXT REFERENCES projects (id) NOT NULL DEFERRABLE INITIALLY DEFERRED",
      ],
    ])("accepts %s", async (_name, definition) => {
      await database.executeScript(`CREATE TABLE notes (${SYNCED_COLUMNS}, ${definition}) STRICT;`);

      await expect(checkConventions(database)).resolves.toEqual([]);
    });

    test.each([
      ["a string", "body TEXT NOT NULL DEFAULT 'REFERENCES projects (id)'"],
      ["a comment", "body TEXT /* REFERENCES projects (id) */"],
      ["a line comment", "body TEXT -- REFERENCES projects (id)\n"],
      ["a quoted column name", '"REFERENCES" TEXT'],
    ])("is not read from %s", async (_name, definition) => {
      await database.executeScript(`CREATE TABLE notes (${SYNCED_COLUMNS}, ${definition}) STRICT;`);

      await expect(checkConventions(database)).resolves.toEqual([]);
    });

    test("reports only the key that is not deferred", async () => {
      await database.executeScript(`
        CREATE TABLE notes (
          ${SYNCED_COLUMNS},
          folder_id TEXT REFERENCES folders (id) DEFERRABLE INITIALLY DEFERRED,
          project_id TEXT REFERENCES projects (id)
        ) STRICT;
      `);

      await expect(checkConventions(database)).resolves.toEqual([NOT_DEFERRED]);
    });

    test("does not credit a later key's deferral to an earlier key", async () => {
      await database.executeScript(`
        CREATE TABLE notes (
          ${SYNCED_COLUMNS},
          project_id TEXT REFERENCES projects (id) NOT NULL,
          folder_id TEXT REFERENCES folders (id) DEFERRABLE INITIALLY DEFERRED
        ) STRICT;
      `);

      await expect(checkConventions(database)).resolves.toEqual([NOT_DEFERRED]);
    });

    test("is accepted before the table it points to exists, and names that table", async () => {
      await database.executeScript(
        `CREATE TABLE notes (${SYNCED_COLUMNS}, project_id TEXT REFERENCES "projects" ("id")) STRICT;`,
      );

      await expect(checkConventions(database)).resolves.toEqual([NOT_DEFERRED]);
    });

    test("must be deferred on a Local Table too", async () => {
      await database.executeScript(
        "CREATE TABLE local_figures (note_id TEXT REFERENCES notes (id)) STRICT;",
      );

      await expect(checkConventions(database)).resolves.toEqual([
        {
          table: "local_figures",
          rule: "foreign key to notes must be DEFERRABLE INITIALLY DEFERRED",
        },
      ]);
    });

    describe("between a normal table and a Local Table", () => {
      const TO_LOCAL = {
        table: "notes",
        rule: "must not have a foreign key to the Local Table local_figures",
      };

      test.each([
        ["plainly", "local_figures"],
        ["quoted", '"local_figures"'],
        ["in brackets", "[local_figures]"],
      ])("is reported from the normal table, written %s", async (_name, parent) => {
        await database.executeScript(`
          CREATE TABLE notes (
            ${SYNCED_COLUMNS},
            figure_id TEXT REFERENCES ${parent} (id) DEFERRABLE INITIALLY DEFERRED
          ) STRICT;
        `);

        await expect(checkConventions(database)).resolves.toEqual([TO_LOCAL]);
      });

      test("is reported when the parent is written in another case", async () => {
        await database.executeScript(`
          CREATE TABLE notes (
            ${SYNCED_COLUMNS},
            figure_id TEXT REFERENCES LOCAL_Figures (id) DEFERRABLE INITIALLY DEFERRED
          ) STRICT;
        `);

        await expect(checkConventions(database)).resolves.toEqual([
          { table: "notes", rule: "must not have a foreign key to the Local Table LOCAL_Figures" },
        ]);
      });

      test("is allowed the other way round", async () => {
        await database.executeScript(`
          CREATE TABLE local_figures (
            note_id TEXT REFERENCES notes (id) DEFERRABLE INITIALLY DEFERRED
          ) STRICT;
        `);

        await expect(checkConventions(database)).resolves.toEqual([]);
      });

      test("is allowed between two Local Tables", async () => {
        await database.executeScript(`
          CREATE TABLE local_figures (
            parent_id TEXT REFERENCES local_totals (id) DEFERRABLE INITIALLY DEFERRED
          ) STRICT;
        `);

        await expect(checkConventions(database)).resolves.toEqual([]);
      });
    });
  });

  test("reports every broken rule of every table", async () => {
    await database.executeScript(`
      CREATE TABLE notes (note TEXT);
      CREATE TABLE local_figures (created_at TEXT DEFAULT 'x');
    `);

    await expect(checkConventions(database)).resolves.toEqual([
      { table: "local_figures", rule: "must be STRICT" },
      { table: "local_figures", rule: "must not have an SQL DEFAULT on created_at" },
      { table: "notes", rule: "must be STRICT" },
      { table: "notes", rule: "must have id as its TEXT primary key" },
      { table: "notes", rule: "must have created_at as non-null TEXT" },
      { table: "notes", rule: "must have updated_at as non-null TEXT" },
      { table: "notes", rule: "must have deleted_at as nullable TEXT" },
      { table: "notes", rule: "must have space_id as non-null TEXT" },
    ]);
  });

  test("finds a foreign key added by a later ALTER TABLE", async () => {
    await database.executeScript(`
      CREATE TABLE notes (${SYNCED_COLUMNS}) STRICT;
      ALTER TABLE notes ADD COLUMN project_id TEXT REFERENCES projects (id);
    `);

    await expect(checkConventions(database)).resolves.toEqual([
      {
        table: "notes",
        rule: "foreign key to projects must be DEFERRABLE INITIALLY DEFERRED",
      },
    ]);
  });
});
