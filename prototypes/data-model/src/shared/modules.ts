import { z } from "zod";

/**
 * Module declarations shared by all variants.
 *
 * - `schema` validates the module-owned fields (`data`). User fields (`custom`) are never read
 *   by domain rules and are validated separately against field definitions.
 * - `fields` declares which fields are references (feed `links_index`) and which are projected
 *   (V2: VIRTUAL generated column, V3: column of the `rm_<type>` read table).
 * - `indexes` lists projected-field tuples to index (V2: partial index on `objects`,
 *   V3: index on the read table). V1 declares the equivalent indexes by hand.
 */

export const roundingModes = ["none", "up", "down", "nearest"] as const;

export const projectSchema = z.object({
  name: z.string().min(1),
  hourlyRate: z.number().nonnegative(),
  currency: z.string().length(3),
  roundingMode: z.enum(roundingModes),
  roundingIntervalMin: z.number().int().positive(),
});

export const timeEntrySchema = z
  .object({
    projectId: z.string().min(1),
    startAt: z.number().int(),
    endAt: z.number().int().nullable(),
    note: z.string().optional(),
  })
  .refine((e) => e.endAt === null || e.endAt > e.startAt, { message: "endAt must be after startAt" });

export const payoutSchema = z.object({
  projectId: z.string().min(1),
  amount: z.number(),
  currency: z.string().length(3),
  paidAt: z.number().int(),
});

export const taskSchema = z.object({
  title: z.string().min(1),
  status: z.enum(["todo", "doing", "done"]),
  dueAt: z.number().int().nullable(),
  projectId: z.string().optional(),
});

export const appointmentSchema = z.object({
  title: z.string().min(1),
  startAt: z.number().int(),
  endAt: z.number().int(),
  projectId: z.string().optional(),
});

export const cashflowSchema = z.object({
  amount: z.number(),
  currency: z.string().length(3),
  at: z.number().int(),
  category: z.string(),
});

export const habitLogSchema = z.object({
  habitId: z.string(),
  at: z.number().int(),
  value: z.number(),
});

/** User-defined field definitions are data too (V1: `field_defs` table, V2/V3: objects). */
export const fieldDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  valueType: z.enum(["text", "number", "bool", "date"]),
  appliesTo: z.array(z.string()),
});

export type SqlType = "text" | "int" | "real";
export type FieldDecl = {
  sql: SqlType;
  /** Reference to another object; derived into links_index. */
  ref?: string;
  /** Exposed as a projection column (V2 generated column, V3 read-table column). */
  projected?: boolean;
  /** Value for objects written before the field existed (lazy upcast inside the projection). */
  default?: number | string;
};

/** SQL expression that reads a module field from `data` (with its declared default). */
export function fieldExpr(field: string, d: FieldDecl, alias = ""): string {
  const raw = `${alias}data ->> '$.${field}'`;
  return d.default === undefined ? raw : `coalesce(${raw}, ${typeof d.default === "string" ? `'${d.default}'` : d.default})`;
}

export const modules = {
  project: {
    module: "work",
    schema: projectSchema,
    fields: {
      name: { sql: "text", projected: true },
      hourlyRate: { sql: "real", projected: true },
      roundingMode: { sql: "text", projected: true },
      roundingIntervalMin: { sql: "int", projected: true },
    },
    indexes: [],
  },
  time_entry: {
    module: "work",
    schema: timeEntrySchema,
    fields: {
      projectId: { sql: "text", ref: "project", projected: true },
      startAt: { sql: "int", projected: true },
      endAt: { sql: "int", projected: true },
    },
    indexes: [
      ["projectId", "startAt", "endAt"],
      ["startAt", "endAt", "projectId"],
      ["endAt", "startAt"],
    ],
  },
  payout: {
    module: "finance",
    schema: payoutSchema,
    fields: {
      projectId: { sql: "text", ref: "project", projected: true },
      amount: { sql: "real", projected: true },
      paidAt: { sql: "int", projected: true },
    },
    indexes: [["projectId"]],
  },
  task: {
    module: "tasks",
    schema: taskSchema,
    fields: { projectId: { sql: "text", ref: "project" } },
    indexes: [],
  },
  appointment: {
    module: "calendar",
    schema: appointmentSchema,
    fields: { projectId: { sql: "text", ref: "project" } },
    indexes: [],
  },
  cashflow: { module: "finance", schema: cashflowSchema, fields: {}, indexes: [] },
  habit_log: { module: "habits", schema: habitLogSchema, fields: {}, indexes: [] },
  field_def: { module: "core", schema: fieldDefSchema, fields: {}, indexes: [] },
} as const satisfies Record<
  string,
  { module: string; schema: z.ZodType; fields: Record<string, FieldDecl>; indexes: readonly (readonly string[])[] }
>;

export type ObjectType = keyof typeof modules;
export const objectTypes = Object.keys(modules) as ObjectType[];

/** The bridge between work and finance: owned by the `payout` bridge module, not by either side. */
export const PAYOUT_COVERS = "payout.covers";

// ---- Type-level helpers: TS types generated from the module declarations -------------------

type SqlToTs<S extends SqlType> = S extends "text" ? string : number;
type Decl<T extends ObjectType> = (typeof modules)[T]["fields"];
export type ProjectedField<T extends ObjectType> = {
  [K in keyof Decl<T>]: Decl<T>[K] extends { projected: true } ? K : never;
}[keyof Decl<T>] &
  string;
/** Row type of the projection of `T` (V3 read table, or V2 generated columns). */
export type ProjectionRow<T extends ObjectType> = { id: string } & {
  [K in ProjectedField<T> as Snake<K>]: Decl<T>[K] extends { sql: infer S extends SqlType } ? SqlToTs<S> | null : never;
};
export type ModuleData<T extends ObjectType> = z.infer<(typeof modules)[T]["schema"]>;

type Snake<S extends string> = S extends `${infer H}${infer R}`
  ? `${H extends Lowercase<H> ? H : `_${Lowercase<H>}`}${Snake<R>}`
  : S;

export function snake<S extends string>(s: S): Snake<S> {
  return s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()) as Snake<S>;
}

/** Name of the VIRTUAL generated column for a projected field in V2. */
export function genCol<T extends ObjectType, F extends ProjectedField<T>>(type: T, field: F): `${T}__${Snake<F>}` {
  return `${type}__${snake(field)}`;
}

export function projectedFields(type: ObjectType): [string, FieldDecl][] {
  return Object.entries(modules[type].fields as Record<string, FieldDecl>).filter(([, d]) => d.projected);
}

export function refFields(type: ObjectType): [string, FieldDecl][] {
  return Object.entries(modules[type].fields as Record<string, FieldDecl>).filter(([, d]) => d.ref);
}

/** Validates module data; throws on invalid input. */
export function validate(type: ObjectType, data: unknown): void {
  modules[type].schema.parse(data);
}
