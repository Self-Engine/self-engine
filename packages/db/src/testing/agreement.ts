import { z } from "zod";
import { openDatabase } from "../better-sqlite3/index.ts";
import { createMigrationRunner } from "../core/index.ts";
import type { Migration } from "../core/index.ts";
import { sqliteBoolean } from "../schema/index.ts";
import { columnsOf, tablesOf } from "./introspect.ts";

import type { ColumnRow } from "./introspect.ts";
import type { SchemaViolation } from "./violation.ts";

function isString(field: z.core.$ZodType): boolean {
  return (
    field._zod.def.type === "string" ||
    (field instanceof z.ZodEnum && field.options.every((value) => typeof value === "string")) ||
    (field instanceof z.ZodLiteral && [...field.values].every((value) => typeof value === "string"))
  );
}

const TYPE_RULES: Readonly<
  Record<
    string,
    {
      readonly fits: (field: z.core.$ZodType) => boolean;
      readonly rule: string;
    }
  >
> = {
  TEXT: { fits: isString, rule: "field must use a string schema for TEXT" },
  INTEGER: {
    fits: (field) => field === sqliteBoolean || (field instanceof z.ZodNumber && field.isInt),
    rule: "field must use an integer schema or sqliteBoolean for INTEGER",
  },
  REAL: {
    fits: (field) => field instanceof z.ZodNumber && !field.isInt,
    rule: "field must use a number schema for REAL",
  },
};

/** The first disagreement for a field, in the order a module author should fix it. */
function fieldRule(field: z.ZodType, { type, notnull }: ColumnRow): string | undefined {
  if (
    field instanceof z.ZodOptional ||
    (field instanceof z.ZodNullable && field.unwrap() instanceof z.ZodOptional)
  )
    return "field must not be optional";
  const nullable = field instanceof z.ZodNullable;
  if (nullable !== (notnull === 0))
    return notnull === 0 ? "field must be nullable" : "field must not be nullable";
  const base = nullable ? field.unwrap() : field;
  if (base instanceof z.ZodBoolean) return "use sqliteBoolean instead of z.boolean()";
  if (base !== sqliteBoolean && !isString(base) && !(base instanceof z.ZodNumber))
    return "unsupported field form; use a string, number, integer or sqliteBoolean schema";
  const match = TYPE_RULES[type.toUpperCase()];
  if (match === undefined) return `unsupported SQLite type ${type}`;
  return match.fits(base) ? undefined : match.rule;
}

/** Runs only this module's migrations in a private in-memory database. */
export async function checkAgreement(
  migrations: readonly Migration[],
  rowMap: Readonly<Record<string, z.ZodObject>>,
): Promise<SchemaViolation[]> {
  const database = openDatabase(":memory:");
  try {
    await createMigrationRunner(database, migrations).run();
    const violations: SchemaViolation[] = [];
    const tables = await tablesOf(database);
    for (const table of Object.keys(rowMap)) {
      if (!tables.some(({ name }) => name === table))
        violations.push({ table, rule: "row map entry must have a table" });
    }
    for (const { name: table } of tables) {
      const shape = rowMap[table]?.shape;
      if (shape === undefined) {
        violations.push({ table, rule: "table must have a row map entry" });
        continue;
      }
      const columns = await columnsOf(database, table);
      for (const column of Object.keys(shape)) {
        if (!columns.some(({ name }) => name === column))
          violations.push({ table, column, rule: "row map field must have a column" });
      }
      for (const metadata of columns) {
        const column = metadata.name;
        if (!Object.hasOwn(shape, column)) {
          violations.push({ table, column, rule: "column must have a row map field" });
          continue;
        }
        const rule = fieldRule(shape[column], metadata);
        if (rule !== undefined) violations.push({ table, column, rule });
      }
    }
    return violations;
  } finally {
    await database.close();
  }
}
