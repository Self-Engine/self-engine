import { ORPCError } from "@orpc/client";
import type { AnyContractProcedure, AnySchema, InferSchemaInput } from "@orpc/contract";
import type { ConflictReasonOf, EntryName, ModuleContract } from "../react/contract-types.ts";
import type { PortAccess } from "../react/port-access.ts";

/**
 * What one Port entry answers in a story or component test (D255):
 * - `{ data }`: the entry's answer, checked against its output schema. It is written as the
 *   schema's input, so an id or a timestamp is a plain string; the checked value is what arrives.
 * - `"loading"`: no answer ever arrives, so the story holds the loading state as long as it shows.
 * - `"unexpected"`: the call fails for a reason the entry does not declare.
 * - `{ conflict }`: the entry's `CONFLICT` with one of the reasons it declares.
 * - `"notFound"`: the entry's `NOT_FOUND`, for an entry that declares it.
 */
export type FixedAnswer<Data, Reason extends string> =
  | { readonly data: Data }
  | "loading"
  | "unexpected"
  | "notFound"
  | ([Reason] extends [never] ? never : { readonly conflict: Reason });

/** The data an entry's output schema accepts, before it brands ids and timestamps. */
type DataOf<Procedure> = Procedure extends AnyContractProcedure
  ? Procedure["~orpc"]["outputSchema"] extends infer Schema extends AnySchema
    ? InferSchemaInput<Schema>
    : unknown
  : never;

/** The Contracts of the modules a story uses, by mount name. */
export type Contracts = Readonly<Record<string, ModuleContract>>;

/** The answers, by mount name and entry name; an entry left out fails when it is called. */
export type FixedAnswers<Of extends Contracts> = {
  readonly [Module in keyof Of]?: {
    readonly [Entry in EntryName<Of[Module]>]?: FixedAnswer<
      DataOf<Of[Module][Entry]>,
      ConflictReasonOf<Of[Module], Entry>
    >;
  };
};

export interface FixedAnswerOptions {
  /**
   * Where a call to an entry without an answer is reported; the call fails either way. By default
   * `console.error`, which fails a story (ADR 0012).
   */
  readonly report?: (problem: string) => void;
}

type AnyAnswer = FixedAnswer<unknown, string>;

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
 * <DataProvider access={access}>…</DataProvider>
 * ```
 */
export function fixedAnswers<Of extends Contracts>(
  contracts: Of,
  answers: FixedAnswers<Of>,
  { report = (problem) => console.error(problem) }: FixedAnswerOptions = {},
): PortAccess {
  const checked = new Map<string, () => Promise<unknown>>();
  for (const [module, entries] of Object.entries(answers as Record<string, object | undefined>)) {
    for (const [entry, answer] of Object.entries(entries ?? {})) {
      const procedure = contracts[module]?.[entry];
      const name = `${module}.${entry}`;
      if (procedure === undefined || !("~orpc" in procedure)) {
        throw new Error(`Fixed Answer for ${name}: the Contract has no such entry.`);
      }
      checked.set(name, answerOf(name, procedure as AnyContractProcedure, answer as AnyAnswer));
    }
  }
  return {
    call(module, entry) {
      const answer = checked.get(`${module}.${entry}`);
      if (answer !== undefined) return answer();
      const problem = `No Fixed Answer for ${module}.${entry}, which the story called.`;
      report(problem);
      return Promise.reject(new Error(problem));
    },
    // Without the Query-to-tables list nothing reloads, and no Query hook is reported (D255).
    describeEntry: () => undefined,
    onTablesChanged: () => () => undefined,
    onReconnected: () => () => undefined,
  };
}

/** Checks `answer` against the entry and returns what each call to it gets. */
function answerOf(
  name: string,
  procedure: AnyContractProcedure,
  answer: AnyAnswer,
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
  const data =
    outputSchema === undefined ? answer.data : checkData(name, outputSchema, answer.data);
  return () => Promise.resolve(data);
}

/** The data as the output schema returns it; fails naming the first field that does not fit. */
function checkData(name: string, schema: AnySchema, data: unknown): unknown {
  const result = schema["~standard"].validate(data);
  if (result instanceof Promise) {
    throw new Error(`Fixed Answer for ${name}: the output schema checks asynchronously.`);
  }
  if (result.issues === undefined) return result.value;
  const [issue] = result.issues;
  const field = (issue?.path ?? [])
    .map((key) => String(typeof key === "object" ? key.key : key))
    .join(".");
  throw new Error(
    `Fixed Answer for ${name} does not fit its output schema at ${field || "the answer"}: ${issue?.message}`,
  );
}

/** Fails unless the entry declares a conflict with `reason`. */
function checkConflict(name: string, schema: AnySchema | undefined, reason: string): void {
  const declared = schema?.["~standard"].validate({ reason });
  if (declared === undefined || declared instanceof Promise || declared.issues !== undefined) {
    throw new Error(`Fixed Answer for ${name}: the entry declares no conflict "${reason}".`);
  }
}
