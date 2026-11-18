import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
// Types only: the hook loads at startup, where the Reason's schemas must not (startup check).
import type { Reason, Refusal, Severity } from "@self-engine/data-protocol";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { type DataAccess, useDataContext } from "./provider.ts";
import type { RefusalNoticeOptions } from "./refusal-notice.ts";

/** Shown when the entry an Operation changes no longer exists, unless the module replaces it. */
export const NOT_FOUND_NOTICE = msg`This entry no longer exists.`;

/** Shown when an Operation failed for a reason the module did not declare. */
export const UNEXPECTED_NOTICE = msg`Something went wrong, and the change was not saved.`;

/**
 * What a module shows for one conflict reason: a translated text at a field of the input. A reason
 * that no field can show, such as one of undo, states `field: null`: the building block then shows
 * the text as a notice itself (D264).
 */
export interface ConflictText<Field extends string> {
  readonly text: MessageDescriptor;
  readonly field: Field | null;
}

/** The input fields a conflict may point at. */
type FieldOf<Input> = keyof Input & string;

/**
 * The input field that shows a Reason naming a column, by the module's table and the column as
 * the database names it (D334): `{ time_entries: { project_id: "projectId" } }`. Only the
 * module's tables, their columns and the fields of the entry's input compile.
 */
export type ColumnFields<Tables, Field extends string> = {
  readonly [Table in keyof Tables & string]?: {
    readonly [Column in keyof Tables[Table] & string]?: Field;
  };
};

/**
 * How a module handles the expected errors of one Operation (D251). The types demand a text for
 * every conflict reason the Contract entry declares, and allow none for an entry without one.
 * `Tables` are the module's tables by their columns (`TablesOf` of its Row Map); without them a
 * Reason names no field the module can map.
 */
export type OperationHandling<Input, Reason extends string, Tables = never> = ([Reason] extends [
  never,
]
  ? { readonly conflicts?: never }
  : { readonly conflicts: { readonly [Key in Reason]: ConflictText<FieldOf<Input>> } }) &
  ([Tables] extends [never]
    ? { readonly columns?: never }
    : {
        /**
         * The field that shows a Reason naming one of these columns, in the place of a
         * Conflict's field. Such a Reason gets no Notice: the form shows it at that field. A
         * Reason without a field, or at a column not named here, goes to the Notice.
         */
        readonly columns?: ColumnFields<Tables, FieldOf<Input>>;
      }) & {
    /**
     * Replaces the default "not found" notice. The caller receives the `notFound` result either
     * way, to close what showed the entry.
     */
    readonly notFound?: (input: Input) => void;
    /**
     * Replaces the shared Notice of a Refusal, for a caller that shows its Reasons itself: it gets
     * the Reasons no field of `columns` shows, and is not called when a field shows every one.
     * The caller receives the `refused` result either way.
     */
    readonly refused?: (refusal: Refusal, input: Input) => void;
  };

/** A Reason of a Refusal that names a column the module maps, with the input field it maps to. */
export interface ReasonAtField<Field extends string> {
  readonly field: Field;
  readonly reason: Reason;
}

/**
 * What an Operation ended with, as a value; the hook throws for none of them (D251).
 * - `success`: the entry's answer. Queries reload through the Table Change of the commit.
 * - `conflict`: a declared reason with the module's text and field, to show at that field. No
 *   notice; for a reason whose field is `null`, the notice with the text was shown instead.
 * - `notFound`: the entry is gone. A notice told the user, unless the module replaced it.
 * - `refused`: a Protection Rule refused the write and nothing changed; the Refusal's Reasons, and
 *   in `atFields` those at a column the module maps, each with its field, for the form to show
 *   there. The shared Notice of a Refusal told the user every other Reason, unless the module
 *   replaced it.
 * - `unexpected`: anything else; a general notice told the user.
 */
export type OperationResult<Output, Reason extends string, Field extends string> =
  | { readonly status: "success"; readonly data: Output }
  | ([Reason] extends [never]
      ? never
      : {
          readonly status: "conflict";
          readonly reason: Reason;
          readonly field: Field | null;
          readonly text: MessageDescriptor;
        })
  | { readonly status: "notFound" }
  | ({
      readonly status: "refused";
      readonly atFields: readonly ReasonAtField<Field>[];
    } & Refusal)
  | { readonly status: "unexpected"; readonly error: unknown };

/** What an Operation hook returns: the call, and whether one is running. */
export interface OperationState<Input, Result> {
  /**
   * Calls the Operation; resolves with its result and never rejects. `refusal` names the entry
   * and adds one action to the Notice of a Refusal.
   */
  readonly run: (input: Input, refusal?: RefusalNoticeOptions) => Promise<Result>;
  /** True from a call until its result, so a button can lock against a second submit. */
  readonly running: boolean;
}

/** An Operation hook, typed from the Contract entry it calls. */
export type OperationHook<Input, Output, Reason extends string> = () => OperationState<
  Input,
  OperationResult<Output, Reason, FieldOf<Input>>
>;

/** The runtime view of `OperationHandling`, without the types that tie it to an entry. */
interface Handling {
  readonly conflicts?: Readonly<Record<string, ConflictText<string>>>;
  readonly columns?: Readonly<
    Record<string, Readonly<Record<string, string | undefined>> | undefined>
  >;
  readonly notFound?: (input: never) => void;
  readonly refused?: (refusal: Refusal, input: never) => void;
}

type AnyResult = OperationResult<unknown, string, string>;

/** Calls the entry and sorts its answer into the five results. */
async function callOperation(
  access: DataAccess["access"],
  module: string,
  entry: string,
  input: unknown,
  handling: Handling,
): Promise<AnyResult> {
  try {
    return { status: "success", data: await access.call(module, entry, input) };
  } catch (error) {
    if (error instanceof ORPCError) {
      if (error.code === "NOT_FOUND") return { status: "notFound" };
      const refused = error.code === "REFUSED" ? refusalOf(error.data, handling) : undefined;
      if (refused !== undefined) return refused;
      const conflict = error.code === "CONFLICT" ? conflictOf(error.data, handling) : undefined;
      if (conflict !== undefined) return conflict;
    }
    return { status: "unexpected", error };
  }
}

/** The conflict a module gave a text for; a reason without one is unexpected. */
function conflictOf(data: unknown, handling: Handling): AnyResult | undefined {
  const reason: unknown =
    typeof data === "object" && data !== null ? Reflect.get(data, "reason") : undefined;
  if (typeof reason !== "string" || !Object.hasOwn(handling.conflicts ?? {}, reason)) return;
  const conflict = handling.conflicts?.[reason];
  return conflict && { status: "conflict", reason, field: conflict.field, text: conflict.text };
}

/**
 * The Refusal with its Reasons, in the shape of the shared `refusal` block; malformed is
 * unexpected. Checked by hand, since the block's schema must not load at startup. The details stay
 * unknown until `findReason` checks them by their definition.
 */
function refusalOf(data: unknown, handling: Handling): AnyResult | undefined {
  const reasons: unknown = isObject(data) ? data["reasons"] : undefined;
  if (!Array.isArray(reasons) || reasons.length === 0 || !reasons.every(isReason)) return;
  const atFields = reasons.flatMap((reason) => {
    const field = fieldOf(reason, handling);
    return field === undefined ? [] : [{ field, reason }];
  });
  return { status: "refused", reasons, atFields };
}

/** The input field the module maps the Reason's table and column to, if it names one. */
function fieldOf({ table, field }: Reason, { columns }: Handling): string | undefined {
  if (field === undefined || columns === undefined || !Object.hasOwn(columns, table)) return;
  const fields = columns[table];
  return fields !== undefined && Object.hasOwn(fields, field) ? fields[field] : undefined;
}

/** Every severity, as a record so that a new one in the format does not compile until it is here. */
const SEVERITIES: Readonly<Record<Severity, true>> = { blocking: true, warning: true };

function isReason(value: unknown): value is Reason {
  if (!isObject(value)) return false;
  const { code, severity, table, row, field } = value;
  return (
    typeof code === "string" &&
    typeof severity === "string" &&
    Object.hasOwn(SEVERITIES, severity) &&
    typeof table === "string" &&
    typeof row === "string" &&
    (field === undefined || typeof field === "string") &&
    "details" in value
  );
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

/**
 * Calls the Operation and announces its "not found", refused and unexpected results and a conflict
 * without a field, as both the hook and the function form do; any other conflict, and a Reason at
 * a column the module maps, is left to the caller.
 */
async function runOperation(
  { access, notify, notifyRefused }: DataAccess,
  module: string,
  entry: string,
  input: unknown,
  handling: Handling,
  refusal: RefusalNoticeOptions = {},
): Promise<AnyResult> {
  const result = await callOperation(access, module, entry, input, handling);
  if (result.status === "conflict" && result.field === null) notify(result.text);
  if (result.status === "unexpected") notify(UNEXPECTED_NOTICE);
  if (result.status === "refused") {
    // A Reason a field shows is the form's; the Notice tells the others.
    const atField = new Set(result.atFields.map(({ reason }) => reason));
    const reasons = result.reasons.filter((reason) => !atField.has(reason));
    // With every Reason at a field there is nothing for a Notice to say.
    if (reasons.length > 0 && handling.refused === undefined)
      notifyRefused({ reasons, ...refusal });
    else if (reasons.length > 0) handling.refused?.({ reasons }, input as never);
  }
  if (result.status === "notFound") {
    if (handling.notFound === undefined) notify(NOT_FOUND_NOTICE);
    else handling.notFound(input as never);
  }
  return result;
}

/** One call of an Operation hook, as the query library hands it on. */
interface Call<Input> {
  readonly input: Input;
  readonly refusal: RefusalNoticeOptions | undefined;
}

/**
 * The Operation hook for the entry `entry` of the module mounted as `module` (`portHooks`).
 * It announces "not found", a Refusal and unexpected errors itself, and leaves a conflict to the
 * form.
 */
export function operationHook<Input, Output, Reason extends string>(
  module: string,
  entry: string,
  handling: Handling,
): OperationHook<Input, Output, Reason> {
  return function useOperationEntry() {
    const data = useDataContext();
    const { mutateAsync } = useMutation({
      mutationKey: [module, entry],
      // The library passes its own context as a second argument, which the Port's call would
      // take for its options; only the input goes on.
      mutationFn: ({ input, refusal }: Call<Input>) =>
        runOperation(data, module, entry, input, handling, refusal),
    });
    // The library's pending flag follows only the latest call, so overlapping calls are counted
    // here: `running` stays true until every call of this hook has its result, and a call of
    // another component on the same entry does not lock this one.
    const [outstanding, setOutstanding] = useState(0);
    const run = useCallback(
      async (input: Input, refusal?: RefusalNoticeOptions) => {
        setOutstanding((count) => count + 1);
        try {
          return (await mutateAsync({ input, refusal })) as OperationResult<
            Output,
            Reason,
            FieldOf<Input>
          >;
        } finally {
          setOutstanding((count) => count - 1);
        }
      },
      [mutateAsync],
    );
    return { run, running: outstanding > 0 };
  };
}

/**
 * An Operation as a function, for code outside React such as a Command (D261). It takes the Port
 * access and notice seams its caller was given, the ones the app gives `DataProvider`
 * (`useDataAccess`), and returns and announces what the hook would, through those seams.
 */
export type OperationFunction<Input, Output, Reason extends string> = (
  data: DataAccess,
  input: Input,
  refusal?: RefusalNoticeOptions,
) => Promise<OperationResult<Output, Reason, FieldOf<Input>>>;

/** The function form of the Operation `entry` of the module mounted as `module` (`portHooks`). */
export function operationFunction<Input, Output, Reason extends string>(
  module: string,
  entry: string,
  handling: Handling,
): OperationFunction<Input, Output, Reason> {
  return (data, input, refusal) =>
    runOperation(data, module, entry, input, handling, refusal) as Promise<
      OperationResult<Output, Reason, FieldOf<Input>>
    >;
}
