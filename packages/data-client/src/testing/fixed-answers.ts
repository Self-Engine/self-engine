import { ORPCError } from "@orpc/client";
import type { AnyContractProcedure, AnySchema, InferSchemaInput } from "@orpc/contract";
import {
  type Clearance,
  clearanceContract,
  inputErrorData,
  type InputPath,
  type ClearanceWrite,
  type Reason,
  type ReasonDefinition,
  type ReasonOf,
  type RowClearance,
  rowClearanceSchema,
} from "@self-engine/data-protocol";
import type {
  CarriesRefusal,
  ConflictReasonOf,
  EntryName,
  InputReasonOf,
  ModuleContract,
} from "../react/contract-types.ts";
import { type ClearanceRequest, NO_DATA_PROCESS, type PortAccess } from "../react/port-access.ts";

/**
 * What one Port entry answers in a story or component test (D255):
 * - `{ data }`: the entry's answer, checked against its output schema. It is written as the
 *   schema's input, so an id or a timestamp is a plain string; the checked value is what arrives.
 * - `"loading"`: no answer ever arrives, so the story holds the loading state as long as it shows.
 * - `"unexpected"`: the call fails for a reason the entry does not declare.
 * - `{ conflict }`: the entry's `CONFLICT` with one of the reasons it declares.
 * - `"notFound"`: the entry's `NOT_FOUND`, for an entry that declares it.
 * - `{ refused }`: the Refusal `REFUSED` with at least one Reason, for an entry that carries the
 *   shared `refusal` block (`Refusable`); for a Query it does not compile. Each Reason is one
 *   whose definition the story passes in `reasons`, the frame's own (`referenced`,
 *   `targetDeleted`) included, with details its definition accepts; the severity is "blocking",
 *   which is all the frame sets (D338).
 * - `{ invalid }`: an input error the Operation raises (D369), with one issue or more, each at a
 *   path and with one of the reasons the entry declares with `inputErrors`; for an entry without
 *   them it does not compile.
 */
export type FixedAnswer<
  Data,
  ConflictReason extends string,
  Defined = never,
  Refusable extends boolean = true,
  InputReason extends string = never,
> =
  | { readonly data: Data }
  | "loading"
  | "unexpected"
  | "notFound"
  | ([ConflictReason] extends [never] ? never : { readonly conflict: ConflictReason })
  | ([Defined] extends [never]
      ? never
      : Refusable extends true
        ? { readonly refused: readonly [FixedReason<Defined>, ...FixedReason<Defined>[]] }
        : never)
  | ([InputReason] extends [never]
      ? never
      : { readonly invalid: readonly [FixedIssue<InputReason>, ...FixedIssue<InputReason>[]] });

/** An issue of an input error a Fixed Answer gives: where in the input, and the declared reason. */
export interface FixedIssue<Reason extends string> {
  readonly path: InputPath;
  readonly reason: Reason;
}

/**
 * A Reason of a Fixed Answer: as the frame sends it, but for the severity, which it sets. Over
 * several definitions it is one of them, whose code picks the details it takes.
 */
export type FixedReason<Definition> = Definition extends ReasonDefinition
  ? Omit<ReasonOf<Definition>, "severity">
  : never;

/** The data an entry's output schema accepts, before it brands ids and timestamps. */
type DataOf<Procedure> = Procedure extends AnyContractProcedure
  ? Procedure["~orpc"]["outputSchema"] extends infer Schema extends AnySchema
    ? InferSchemaInput<Schema>
    : unknown
  : never;

/** The Contracts of the modules a story uses, by mount name. */
export type Contracts = Readonly<Record<string, ModuleContract>>;

/**
 * The answers, by mount name and entry name; an entry left out fails when it is called. A Refusal
 * may carry the Reasons of `Reasons`, the definitions the story passes.
 */
export type FixedAnswers<Of extends Contracts, Reasons extends ReasonDefinition = never> = {
  readonly [Module in keyof Of]?: {
    readonly [Entry in EntryName<Of[Module]>]?: FixedAnswer<
      DataOf<Of[Module][Entry]>,
      ConflictReasonOf<Of[Module], Entry>,
      Reasons,
      CarriesRefusal<Of[Module], Entry>,
      InputReasonOf<Of[Module], Entry>
    >;
  };
};

type FixedClearanceRow<Definition> = {
  readonly table: string;
  readonly row: string;
  readonly writes: Readonly<
    Partial<
      Record<
        ClearanceWrite,
        | Exclude<Clearance, { state: "blocked" }>
        | {
            readonly state: "blocked";
            readonly reasons: readonly [FixedReason<Definition>, ...FixedReason<Definition>[]];
          }
      >
    >
  >;
};

export interface FixedAnswerOptions<Reasons extends ReasonDefinition = never> {
  /** The root Clearance's answers by table, row and kind of write. */
  readonly clearance?: readonly FixedClearanceRow<NoInfer<Reasons>>[];
  /**
   * The definitions of the Reasons a Refusal or Clearance may carry, the frame's own (`referenced`,
   * `targetDeleted`) as well as a module's: a Reason of another code fails, as a conflict the
   * Contract does not declare does. The story passes them, so that their schemas load only where
   * a story or test uses them.
   */
  readonly reasons?: readonly Reasons[];
  /**
   * Where a call to an entry without an answer is reported; the call fails either way. By default
   * `console.error`, which fails a story (ADR 0012).
   */
  readonly report?: (problem: string) => void;
}

type AnyAnswer = FixedAnswer<unknown, string, ReasonDefinition, true, string>;

/**
 * The Port access of a story or component test: every entry answers what `answers` fixes for it
 * (D196, D255). Each answer is checked against the entry in `contracts` when this is called, so a
 * story fails at once, naming the entry and the field, when it shows what the Data Process could
 * never send. An Operation returns its answer and changes nothing: no Table Change follows, and
 * no story plays a flow.
 *
 * ```tsx
 * const access = fixedAnswers({ notes: notesContract }, {
 *   notes: { list: { data: [note] }, update: { conflict: "title_taken" }, get: "notFound" },
 * });
 * const refusing = fixedAnswers({ notes: notesContract }, {
 *   notes: { delete: { refused: [{ code: "pinned", table: "notes", row, details }] } },
 * }, { reasons: [pinnedNote] });
 * <DataProvider access={access}>…</DataProvider>
 * ```
 */
export function fixedAnswers<Of extends Contracts, Reasons extends ReasonDefinition = never>(
  contracts: Of,
  answers: FixedAnswers<Of, NoInfer<Reasons>>,
  {
    report = (problem) => console.error(problem),
    reasons = [],
    clearance = [],
  }: FixedAnswerOptions<Reasons> = {},
): PortAccess {
  const defined = new Map<string, ReasonDefinition>(
    reasons.map((definition) => [definition.code, definition]),
  );
  const checked = new Map<string, (input: unknown) => Promise<unknown>>();
  const clearanceAnswers =
    clearance.length > 0 ? clearanceAnswer(clearance, defined, report) : undefined;
  for (const [module, entries] of Object.entries(answers as Record<string, object | undefined>)) {
    for (const [entry, answer] of Object.entries(entries ?? {})) {
      const procedure = contracts[module]?.[entry];
      const name = `${module}.${entry}`;
      if (procedure === undefined || !("~orpc" in procedure)) {
        throw new Error(`Fixed Answer for ${name}: the Contract has no such entry.`);
      }
      checked.set(
        name,
        answerOf(name, procedure as AnyContractProcedure, answer as AnyAnswer, defined),
      );
    }
  }
  return {
    // Without the Query-to-tables list nothing reloads, and no Query hook is reported (D255).
    ...NO_DATA_PROCESS,
    call(module, entry, input) {
      const answer = checked.get(`${module}.${entry}`);
      return answer === undefined ? noAnswer(module, entry, report) : answer(input);
    },
    clearance: (request) =>
      clearanceAnswers === undefined
        ? noAnswer("", "clearance", report)
        : clearanceAnswers(request),
  };
}

/** Reports a call no Fixed Answer answers, naming its entry; the call fails either way. */
function noAnswer(
  module: string,
  entry: string,
  report: (problem: string) => void,
): Promise<never> {
  const problem = `No Fixed Answer for ${module === "" ? entry : `${module}.${entry}`}, which the story called.`;
  report(problem);
  return Promise.reject(new Error(problem));
}

/**
 * One Port access for a story that shows more than one owner's data, such as the whole app: each
 * mount is answered by the access its owner's helper built, and a call to any other mount fails
 * like a call to an entry without an answer.
 *
 * ```ts
 * answersByMount({ notes: notesAnswers(), backups: backupAnswers({ list: { data: [] } }) });
 * ```
 */
export function answersByMount<Mounts extends Readonly<Record<string, PortAccess>>>(
  accesses: Mounts,
  {
    report = (problem) => console.error(problem),
    clearance = {},
  }: Pick<FixedAnswerOptions, "report"> & {
    /**
     * The mount whose access answers the Clearance of each table, by the table's SQL name, which
     * need not be the mount's: `{ project_entries: "projectEntries" }`. A Clearance of another
     * table fails like a call without an answer.
     */
    readonly clearance?: Readonly<Record<string, keyof Mounts & string>>;
  } = {},
): PortAccess {
  const accessOf = (mount: string | undefined) =>
    mount !== undefined && Object.hasOwn(accesses, mount) ? accesses[mount] : undefined;
  return {
    ...NO_DATA_PROCESS,
    call(module, entry, input, signal) {
      const access = accessOf(module);
      return access === undefined
        ? noAnswer(module, entry, report)
        : access.call(module, entry, input, signal);
    },
    clearance(request, signal) {
      const mount = Object.hasOwn(clearance, request.table) ? clearance[request.table] : undefined;
      const access = accessOf(mount);
      return access === undefined
        ? noAnswer("", `clearance of ${request.table}`, report)
        : access.clearance(request, signal);
    },
  };
}

/** Checks every fixture up front, then answers only for the rows and writes the caller asked for. */
function clearanceAnswer(
  rows: readonly FixedClearanceRow<ReasonDefinition>[],
  defined: ReadonlyMap<string, ReasonDefinition>,
  report: (problem: string) => void,
): (input: ClearanceRequest) => Promise<readonly RowClearance[]> {
  const byTable = new Map<string, Map<string, RowClearance["writes"]>>();
  for (const { table, row, writes } of rows) {
    const name = `clearance for ${table}/${row}`;
    const answers = Object.fromEntries(
      Object.entries(writes).map(([write, answer]) => [
        write,
        answer.state === "blocked"
          ? {
              ...answer,
              reasons: answer.reasons.map((reason) => {
                // The Data Process answers a row with the Reasons for that row of the asked table.
                if (reason.table !== table || reason.row !== row) {
                  throw new Error(
                    `Fixed Answer for ${name}: a Reason of ${reason.table}/${reason.row} cannot block it.`,
                  );
                }
                return checkReason(name, reason, defined);
              }),
            }
          : answer,
      ]),
    );
    const checked = rowClearanceSchema.parse({ row, writes: answers });
    const tableAnswers = byTable.get(table) ?? new Map<string, RowClearance["writes"]>();
    if (tableAnswers.has(row)) throw new Error(`Duplicate Fixed Answer for ${name}.`);
    tableAnswers.set(row, checked.writes);
    byTable.set(table, tableAnswers);
  }
  return async ({ table: asked, rows: askedRows, writes: askedWrites }) => {
    // What the Port sends of a query, as `portAccessOf` does, checked as the Data Process does.
    const { table, rows, writes } = clearanceContract["~orpc"].inputSchema!.parse({
      table: asked,
      rows: askedRows,
      writes: askedWrites,
    });
    // One answer per asked row, in the order first asked, as the Data Process answers.
    return [...new Set(rows)].map((row) => {
      const answers = byTable.get(table)?.get(row);
      const picked: RowClearance["writes"] = {};
      for (const write of writes) {
        const answer = answers?.[write];
        if (answer === undefined) {
          const problem = `No Fixed Answer for clearance of ${write} on ${table}/${row}.`;
          report(problem);
          throw new Error(problem);
        }
        // A copy per answer, as the Port delivers it: a change to one leaves the fixture.
        picked[write] = structuredClone(answer);
      }
      return { row, writes: picked };
    });
  };
}

/** Checks `answer` against the entry and returns what each call to it gets. */
function answerOf(
  name: string,
  procedure: AnyContractProcedure,
  answer: AnyAnswer,
  defined: ReadonlyMap<string, ReasonDefinition>,
): () => Promise<unknown> {
  const { outputSchema, errorMap } = procedure["~orpc"];
  if (answer === "loading") return () => new Promise(() => undefined);
  if (answer === "unexpected") {
    return () => Promise.reject(new Error(`The Fixed Answer of ${name} is an unexpected error.`));
  }
  if (answer === "notFound") {
    if (!("NOT_FOUND" in errorMap)) {
      throw new Error(`Fixed Answer for ${name}: the entry does not declare "not found".`);
    }
    return () => Promise.reject(new ORPCError("NOT_FOUND"));
  }
  if ("conflict" in answer) {
    const reason = answer.conflict;
    checkConflict(name, errorMap["CONFLICT"]?.data, reason);
    return () => Promise.reject(new ORPCError("CONFLICT", { data: { reason } }));
  }
  if ("invalid" in answer) {
    const declared = errorMap["BAD_REQUEST"]?.data;
    if (declared === undefined) {
      throw new Error(`Fixed Answer for ${name}: the entry declares no input error.`);
    }
    // As the Data Process sends it: the data `inputError` of the storage frame gives, one issue
    // per given issue, checked against the reasons the entry declares.
    const data = checkData(
      name,
      declared,
      { issues: answer.invalid.flatMap(({ path, reason }) => inputErrorData(path, reason).issues) },
      "its declared input errors",
    );
    return () =>
      Promise.reject(new ORPCError("BAD_REQUEST", { message: "Input validation failed", data }));
  }
  if ("refused" in answer) {
    const refused = errorMap["REFUSED"];
    if (refused === undefined) {
      throw new Error(`Fixed Answer for ${name}: the entry carries no refusal block.`);
    }
    // Untyped input may give anything: a Refusal is a list of one Reason at least.
    const given: unknown = answer.refused;
    if (!Array.isArray(given) || given.length === 0) {
      throw new Error(`Fixed Answer for ${name}: a refusal carries a list of one Reason at least.`);
    }
    const reasons = (given as readonly Omit<Reason, "severity">[]).map((reason) =>
      checkReason(name, reason, defined),
    );
    // The envelope as the entry's own refusal block takes it.
    if (refused.data !== undefined) checkData(name, refused.data, { reasons }, "its refusal block");
    return () =>
      Promise.reject(new ORPCError("REFUSED", { status: refused?.status, data: { reasons } }));
  }
  const data =
    outputSchema === undefined ? answer.data : checkData(name, outputSchema, answer.data);
  return () => Promise.resolve(data);
}

/** The data as the schema returns it; fails naming the first field that does not fit. */
function checkData(
  name: string,
  schema: AnySchema,
  data: unknown,
  of = "its output schema",
): unknown {
  const result = schema["~standard"].validate(data);
  if (result instanceof Promise) {
    throw new Error(`Fixed Answer for ${name}: ${of} checks asynchronously.`);
  }
  if (result.issues === undefined) return result.value;
  const [issue] = result.issues;
  const field = (issue?.path ?? [])
    .map((key) => String(typeof key === "object" ? key.key : key))
    .join(".");
  throw new Error(
    `Fixed Answer for ${name} does not fit ${of} at ${field || "the answer"}: ${issue?.message}`,
  );
}

/**
 * The Reason as the frame sends it, with the severity it sets; fails unless a definition of its
 * code accepts its details, naming the first detail that does not fit.
 */
function checkReason(
  name: string,
  reason: Omit<Reason, "severity">,
  defined: ReadonlyMap<string, ReasonDefinition>,
): Reason {
  const definition = defined.get(reason.code);
  if (definition === undefined) {
    throw new Error(`Fixed Answer for ${name}: no Reason "${reason.code}" is defined.`);
  }
  const of = `the details of the Reason "${reason.code}"`;
  const details = checkData(name, definition.details, reason.details, of);
  return { ...reason, severity: "blocking", details };
}

/** Fails unless the entry declares a conflict with `reason`. */
function checkConflict(name: string, schema: AnySchema | undefined, reason: string): void {
  const declared = schema?.["~standard"].validate({ reason });
  if (declared === undefined || declared instanceof Promise || declared.issues !== undefined) {
    throw new Error(`Fixed Answer for ${name}: the entry declares no conflict "${reason}".`);
  }
}
