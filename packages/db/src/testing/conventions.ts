import { sql } from "kysely";
import type { Database } from "../core/index.ts";

/** One broken convention: which table, and the rule it breaks. */
export interface ConventionViolation {
  readonly table: string;
  readonly rule: string;
}

interface TableRow {
  readonly name: string;
  readonly strict: number;
  readonly sql: string;
}

interface ColumnRow {
  readonly name: string;
  readonly type: string;
  readonly notnull: number;
  readonly dflt_value: string | null;
  readonly pk: number;
}

/** Tables the conventions do not apply to, by their exact names. */
const SKIPPED_TABLES: ReadonlySet<string> = new Set([
  "kysely_migration",
  "kysely_migration_lock",
  "sqlite_sequence",
  "sqlite_stat1",
  "sqlite_stat2",
  "sqlite_stat3",
  "sqlite_stat4",
]);

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

/** SQLite treats table names without regard to case, so the marker does too. */
function isLocalTable(name: string): boolean {
  return name.toLowerCase().startsWith("local_");
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
  readonly deferred: boolean;
}

/** Reads the clause after `REFERENCES`, whose first token is at `start`: the parent's name. */
function readForeignKey(tokens: readonly string[], start: number): ForeignKey {
  const word = (index: number) => tokens[index]?.toUpperCase();
  let at = start + 1;
  if (tokens[at] === "(") at = tokens.indexOf(")", at) + 1;
  while (word(at) === "ON" || word(at) === "MATCH") {
    if (word(at) === "MATCH") at += 2;
    else at += word(at + 2) === "SET" || word(at + 2) === "NO" ? 4 : 3;
  }
  return {
    parent: unquoted(tokens[start] ?? ""),
    deferred:
      word(at) === "DEFERRABLE" && word(at + 1) === "INITIALLY" && word(at + 2) === "DEFERRED",
  };
}

/**
 * The foreign keys of a `CREATE TABLE` statement. SQLite's `foreign_key_list` does not report
 * deferral, so they are read from the text SQLite keeps. `REFERENCES` is a reserved word, so
 * unquoted it starts nothing else.
 */
function foreignKeysOf(createTable: string): ForeignKey[] {
  const tokens = tokensOf(createTable);
  return tokens.flatMap((token, index) =>
    token.toUpperCase() === "REFERENCES" ? [readForeignKey(tokens, index + 1)] : [],
  );
}

function foreignKeyRules(table: string, createTable: string): string[] {
  return foreignKeysOf(createTable).flatMap(({ parent, deferred }) => [
    ...(deferred ? [] : [`foreign key to ${parent} must be DEFERRABLE INITIALLY DEFERRED`]),
    ...(!isLocalTable(table) && isLocalTable(parent)
      ? [`must not have a foreign key to the Local Table ${parent}`]
      : []),
  ]);
}

async function columnsOf(database: Database, table: string): Promise<readonly ColumnRow[]> {
  const { rows } = await sql<ColumnRow>`
    SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(${table})
  `.execute(database.kysely);
  return rows;
}

/** Reads a database's schema after its migrations and reports every broken table convention. */
export async function checkConventions(database: Database): Promise<ConventionViolation[]> {
  const { rows } = await sql<TableRow>`
    SELECT list.name, list.strict, entry.sql
    FROM pragma_table_list AS list
    JOIN sqlite_schema AS entry ON entry.name = list.name AND entry.type = 'table'
    WHERE list.schema = 'main'
    ORDER BY list.name
  `.execute(database.kysely);
  const violations: ConventionViolation[] = [];
  for (const { name, strict, sql: createTable } of rows) {
    if (SKIPPED_TABLES.has(name)) continue;
    const rules = [
      ...(strict === 1 ? [] : ["must be STRICT"]),
      ...columnRules(name, await columnsOf(database, name)),
      ...foreignKeyRules(name, createTable),
    ];
    violations.push(...rules.map((rule) => ({ table: name, rule })));
  }
  return violations;
}
