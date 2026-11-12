import { z } from "zod";
import { openDatabase } from "../better-sqlite3/index.ts";
import { createMigrationRunner } from "../core/index.ts";
import type { Migration } from "../core/index.ts";
import { sqliteBoolean } from "../schema/index.ts";
import { columnsOf, tablesOf } from "./schema.ts";

/** One disagreement between a module's SQL and its row map. */
export interface AgreementViolation {
  readonly table: string;
  readonly column?: string;
  readonly rule: string;
}

/** Runs only this module's migrations in a private in-memory database. */
export async function checkAgreement(
  migrations: readonly Migration[],
  rowMap: Readonly<Record<string, z.ZodObject>>,
): Promise<AgreementViolation[]> {
  const database = openDatabase(":memory:");
  try {
    await createMigrationRunner(database, migrations).run();
    const violations: AgreementViolation[] = [];
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
      for (const { name: column, type, notnull } of columns) {
        if (!Object.hasOwn(shape, column)) {
          violations.push({ table, column, rule: "column must have a row map field" });
          continue;
        }
        const field: z.ZodType = shape[column];
        if (
          field instanceof z.ZodOptional ||
          (field instanceof z.ZodNullable && field.unwrap() instanceof z.ZodOptional)
        ) {
          violations.push({ table, column, rule: "field must not be optional" });
          continue;
        }
        const nullable = field instanceof z.ZodNullable;
        if (nullable !== (notnull === 0)) {
          violations.push({
            table,
            column,
            rule: notnull === 0 ? "field must be nullable" : "field must not be nullable",
          });
          continue;
        }
        const base = nullable ? field.unwrap() : field;
        if (base._zod.def.type === "boolean") {
          violations.push({ table, column, rule: "use sqliteBoolean instead of z.boolean()" });
          continue;
        }
        if (base !== sqliteBoolean && !["string", "number"].includes(base._zod.def.type)) {
          violations.push({
            table,
            column,
            rule: "unsupported field form; use a string, number, integer or sqliteBoolean schema",
          });
          continue;
        }
        const number = base instanceof z.ZodNumber;
        const rules: Record<string, readonly [boolean, string]> = {
          TEXT: [base._zod.def.type === "string", "field must use a string schema for TEXT"],
          INTEGER: [
            base === sqliteBoolean || (number && base.isInt),
            "field must use an integer schema or sqliteBoolean for INTEGER",
          ],
          REAL: [number && !base.isInt, "field must use a number schema for REAL"],
        };
        const match = rules[type.toUpperCase()];
        if (match === undefined || !match[0])
          violations.push({ table, column, rule: match?.[1] ?? `unsupported SQLite type ${type}` });
      }
    }
    return violations;
  } finally {
    await database.close();
  }
}
