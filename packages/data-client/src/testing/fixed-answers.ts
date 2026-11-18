import { ORPCError } from "@orpc/client";
import type { AnyContractProcedure, AnySchema, InferSchemaInput } from "@orpc/contract";
import type { Reason, ReasonDefinition, ReasonOf } from "@self-engine/data-protocol";
import type { ConflictReasonOf, EntryName, ModuleContract } from "../react/contract-types.ts";
import { NO_DATA_PROCESS, type PortAccess } from "../react/port-access.ts";

/**
 * What one Port entry answers in a story or component test (D255):
 * - `{ data }`: the entry's answer, checked against its output schema. It is written as the
 *   schema's input, so an id or a timestamp is a plain string; the checked value is what arrives.
 * - `"loading"`: no answer ever arrives, so the story holds the loading state as long as it shows.
 * - `"unexpected"`: the call fails for a reason the entry does not declare.
 * - `{ conflict }`: the entry's `CONFLICT` with one of the reasons it declares.
 * - `"notFound"`: the entry's `NOT_FOUND`, for an entry that declares it.
 * - `{ refused }`: the Refusal `REFUSED` with these Reasons, for an entry that carries the shared
 *   `refusal` block. Each Reason is one whose definition the story passes in `reasons`, the
 *   frame's own (`referenced`, `targetDeleted`) included, with details its definition accepts;
 *   the severity is "blocking", which is all the frame sets (D338).
 */
export type FixedAnswer<Data, ConflictReason extends string, Defined = never> =
  | { readonly data: Data }
  | "loading"
  | "unexpected"
  | "notFound"
  | ([ConflictReason] extends [never] ? never : { readonly conflict: ConflictReason })
  | ([Defined] extends [never]
      ? never
      : { readonly refused: readonly [FixedReason<Defined>, ...FixedReason<Defined>[]] });

/** A Reason of a Fixed Answer: as the frame sends it, but for the severity, which it sets. */
type FixedReason<Definition> = Definition extends ReasonDefinition
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
      Reasons
    >;
  };
};

export interface FixedAnswerOptions<Reasons extends ReasonDefinition = never> {
  /**
   * The definitions of the Reasons a Refusal may carry, the frame's own (`referenced`,
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

type AnyAnswer = FixedAnswer<unknown, string, ReasonDefinition>;

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
  { report = (problem) => console.error(problem), reasons = [] }: FixedAnswerOptions<Reasons> = {},
): PortAccess {
  const defined = new Map<string, ReasonDefinition>(
    reasons.map((definition) => [definition.code, definition]),
  );
  const checked = new Map<string, () => Promise<unknown>>();
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
    call(module, entry) {
      const answer = checked.get(`${module}.${entry}`);
      if (answer !== undefined) return answer();
      const problem = `No Fixed Answer for ${module}.${entry}, which the story called.`;
      report(problem);
      return Promise.reject(new Error(problem));
    },
  };
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
export function answersByMount(
  accesses: Readonly<Record<string, PortAccess>>,
  { report = (problem) => console.error(problem) }: Pick<FixedAnswerOptions, "report"> = {},
): PortAccess {
  return {
    ...NO_DATA_PROCESS,
    call(module, entry, input, signal) {
      const access = Object.hasOwn(accesses, module) ? accesses[module] : undefined;
      if (access !== undefined) return access.call(module, entry, input, signal);
      const problem = `No Fixed Answer for ${module}.${entry}, which the story called.`;
      report(problem);
      return Promise.reject(new Error(problem));
    },
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
  if ("refused" in answer) {
    if (!("REFUSED" in errorMap)) {
      throw new Error(`Fixed Answer for ${name}: the entry carries no refusal block.`);
    }
    const reasons = answer.refused.map((reason) => checkReason(name, reason, defined));
    const refused = errorMap["REFUSED"];
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
