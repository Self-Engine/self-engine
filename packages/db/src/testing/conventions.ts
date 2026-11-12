import { sql } from "kysely";
import type { Database } from "../core/index.ts";

import type { SchemaViolation } from "./violation.ts";

import { columnsOf, tablesOf } from "./introspect.ts";
import type { ColumnRow } from "./introspect.ts";

const TIMESTAMP_COLUMNS = ["created_at", "updated_at", "deleted_at"];

function isText(column: ColumnRow): boolean {
  return column.type.toUpperCase() === "TEXT";
}

const isNonNullText = (column: ColumnRow) => isText(column) && column.notnull === 1;

/** What a table that is not a Local Table must have. */
const REQUIRED_COLUMNS: readonly {
  readonly name: string;
  readonly rule: string;
  readonly fits: (column: ColumnRow, columns: readonly ColumnRow[]) => boolean;
}[] = [
  {
    name: "id",
    rule: "must have id as its TEXT primary key",
    fits: (column, columns) =>
      isText(column) && column.pk === 1 && columns.every((other) => other.pk <= 1),
  },
  {
    name: "created_at",
    rule: "must have created_at as non-null TEXT",
    fits: isNonNullText,
  },
  {
    name: "updated_at",
    rule: "must have updated_at as non-null TEXT",
    fits: isNonNullText,
  },
  {
    name: "deleted_at",
    rule: "must have deleted_at as nullable TEXT",
    fits: (column) => isText(column) && column.notnull === 0,
  },
  {
    name: "space_id",
    rule: "must have space_id as non-null TEXT",
    fits: isNonNullText,
  },
];

/** A Local Table is marked by exactly this prefix, in lower case. */
function isLocalTable(name: string): boolean {
  return name.startsWith("local_");
}

function columnRules(table: string, columns: readonly ColumnRow[]): string[] {
  const missingOrWrong = isLocalTable(table)
    ? []
    : REQUIRED_COLUMNS.filter(({ name, fits }) => {
        const column = columns.find((candidate) => candidate.name === name);
        return column === undefined || !fits(column, columns);
      }).map(({ rule }) => rule);
  const defaulted = columns
    .filter((column) => TIMESTAMP_COLUMNS.includes(column.name) && column.dflt_value !== null)
    .map((column) => `must not have an SQL DEFAULT on ${column.name}`);
  return [...missingOrWrong, ...defaulted];
}

// A comment, a string, a quoted name, a word, or any other single character.
const SQL_TOKEN =
  /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|[\w$]+|\S/g;

function tokensOf(createTable: string): string[] {
  return (createTable.match(SQL_TOKEN) ?? []).filter(
    (token) => !token.startsWith("--") && !token.startsWith("/*"),
  );
}

function unquoted(name: string): string {
  return /^["'`[]/.test(name)
    ? name.slice(1, -1).replace(/""|''|``/g, (pair) => pair.charAt(0))
    : name;
}

interface ForeignKey {
  readonly parent: string;
  deferred: boolean;
}

/**
 * The foreign keys of a `CREATE TABLE` statement. SQLite's `foreign_key_list` does not report
 * deferral, so they are read from the text SQLite keeps. `REFERENCES` and `DEFERRABLE` are
 * reserved words, so unquoted they start nothing else. Like SQLite, a deferral clause applies to
 * the latest foreign key, even with other column constraints in between, and the last clause wins.
 */
function foreignKeysOf(createTable: string): ForeignKey[] {
  const tokens = tokensOf(createTable);
  const word = (index: number) => tokens[index]?.toUpperCase();
  const keys: ForeignKey[] = [];
  tokens.forEach((_token, index) => {
    if (word(index) === "REFERENCES") {
      keys.push({ parent: unquoted(tokens[index + 1] ?? ""), deferred: false });
    } else if (word(index) === "DEFERRABLE") {
      const latest = keys.at(-1);
      if (latest === undefined) return;
      latest.deferred =
        word(index - 1) !== "NOT" &&
        word(index + 1) === "INITIALLY" &&
        word(index + 2) === "DEFERRED";
    }
  });
  return keys;
}

function foreignKeyRules(table: string, createTable: string): string[] {
  return foreignKeysOf(createTable).flatMap(({ parent, deferred }) => [
    ...(deferred ? [] : [`foreign key to ${parent} must be DEFERRABLE INITIALLY DEFERRED`]),
    // SQLite resolves a referenced table's name in any case.
    ...(!isLocalTable(table) && isLocalTable(parent.toLowerCase())
      ? [`must not have a foreign key to the Local Table ${parent}`]
      : []),
  ]);
}

interface IndexRow {
  readonly name: string;
  readonly origin: string;
  readonly unique: number;
  readonly partial: number;
  readonly sql: string | null;
}

/** Only the live-row predicate, allowing SQL quoting, comments and redundant parentheses. */
function isLiveRowIndex(index: IndexRow): boolean {
  if (index.partial !== 1 || index.sql === null) return false;
  const tokens = tokensOf(index.sql);
  const where = tokens.findIndex((token) => token.toUpperCase() === "WHERE");
  const predicate = tokens.slice(where + 1).filter((token) => !["(", ")", ";"].includes(token));
  return (
    where !== -1 &&
    predicate.length === 3 &&
    !predicate[0]?.startsWith("'") &&
    unquoted(predicate[0] ?? "").toLowerCase() === "deleted_at" &&
    predicate[1]?.toUpperCase() === "IS" &&
    predicate[2]?.toUpperCase() === "NULL"
  );
}

async function indexRules(
  database: Database,
  table: string,
  createTable: string,
): Promise<string[]> {
  if (isLocalTable(table)) return [];
  const { rows } = await sql<IndexRow>`
    SELECT list.name, list.origin, list."unique", list.partial, entry.sql
    FROM pragma_index_list(${table}) AS list
    LEFT JOIN sqlite_schema AS entry ON entry.name = list.name AND entry.type = 'index'
    ORDER BY list.name
  `.execute(database.kysely);
  // SQLite may fold a redundant UNIQUE into the primary key's index, so read the declaration.
  const rules = tokensOf(createTable)
    .filter((token) => token.toUpperCase() === "UNIQUE")
    .map(
      () =>
        "must not have an inline UNIQUE constraint; use a partial unique index starting with space_id WHERE deleted_at IS NULL",
    );
  for (const index of rows) {
    if (index.origin === "pk" || index.origin === "u") continue;
    const { rows: columns } = await sql<{ name: string | null }>`
      SELECT name FROM pragma_index_info(${index.name}) ORDER BY seqno
    `.execute(database.kysely);
    if (index.unique === 1 && !isLiveRowIndex(index)) {
      rules.push(`unique index ${index.name} must be partial on deleted_at IS NULL`);
    }
    if (columns[0]?.name?.toLowerCase() !== "space_id") {
      rules.push(`index ${index.name} must start with space_id`);
    }
  }
  return rules;
}

/** Reads a database's schema after its migrations and reports every broken table convention. */
export async function checkConventions(database: Database): Promise<SchemaViolation[]> {
  const rows = await tablesOf(database);
  const violations: SchemaViolation[] = [];
  for (const { name, strict, sql: createTable } of rows) {
    const rules = [
      ...(strict === 1 ? [] : ["must be STRICT"]),
      ...columnRules(name, await columnsOf(database, name)),
      ...foreignKeyRules(name, createTable),
      ...(await indexRules(database, name, createTable)),
    ];
    violations.push(...rules.map((rule) => ({ table: name, rule })));
  }
  return violations;
}
