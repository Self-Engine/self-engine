import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import type { PortAccess } from "./port-access.ts";
import { useDataContext } from "./provider.ts";

/** Shown when the entry an Operation changes no longer exists, unless the module replaces it. */
export const NOT_FOUND_NOTICE = msg`This entry no longer exists.`;

/** Shown when an Operation failed for a reason the module did not declare. */
export const UNEXPECTED_NOTICE = msg`Something went wrong, and the change was not saved.`;

/** What a module shows for one conflict reason: a translated text at a field of the input. */
export interface ConflictText<Field extends string> {
  readonly text: MessageDescriptor;
  readonly field: Field;
}

/** The input fields a conflict may point at. */
type FieldOf<Input> = keyof Input & string;

/**
 * How a module handles the expected errors of one Operation (D251). The types demand a text for
 * every conflict reason the Contract entry declares, and allow none for an entry without one.
 */
export type OperationHandling<Input, Reason extends string> = ([Reason] extends [never]
  ? { readonly conflicts?: never }
  : { readonly conflicts: { readonly [Key in Reason]: ConflictText<FieldOf<Input>> } }) & {
  /**
   * Replaces the default "not found" notice. The caller receives the `notFound` result either
   * way, to close what showed the entry.
   */
  readonly notFound?: (input: Input) => void;
};

/**
 * What an Operation ended with, as a value; the hook throws for none of them (D251).
 * - `success`: the entry's answer. Queries reload through the Table Change of the commit.
 * - `conflict`: a declared reason with the module's text and field, to show at that field. No
 *   notice.
 * - `notFound`: the entry is gone. A notice told the user, unless the module replaced it.
 * - `unexpected`: anything else; a general notice told the user.
 */
export type OperationResult<Output, Reason extends string, Field extends string> =
  | { readonly status: "success"; readonly data: Output }
  | ([Reason] extends [never]
      ? never
      : {
          readonly status: "conflict";
          readonly reason: Reason;
          readonly field: Field;
          readonly text: MessageDescriptor;
        })
  | { readonly status: "notFound" }
  | { readonly status: "unexpected"; readonly error: unknown };

/** What an Operation hook returns: the call, and whether one is running. */
export interface OperationState<Input, Result> {
  /** Calls the Operation; resolves with its result and never rejects. */
  readonly run: (input: Input) => Promise<Result>;
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
  readonly notFound?: (input: never) => void;
}

type AnyResult = OperationResult<unknown, string, string>;

/** Calls the entry and sorts its answer into the four results. */
async function callOperation(
  access: PortAccess,
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
 * The Operation hook for the entry `entry` of the module mounted as `module` (`portHooks`).
 * It announces "not found" and unexpected errors itself, and leaves a conflict to the form.
 */
export function operationHook<Input, Output, Reason extends string>(
  module: string,
  entry: string,
  handling: Handling,
): OperationHook<Input, Output, Reason> {
  return function useOperationEntry() {
    const { access, notify } = useDataContext();
    const { mutateAsync, isPending } = useMutation({
      mutationKey: [module, entry],
      // The library passes its own context as a second argument, which the Port's call would
      // take for its options; only the input goes on.
      async mutationFn(input: Input): Promise<AnyResult> {
        const result = await callOperation(access, module, entry, input, handling);
        if (result.status === "unexpected") notify(UNEXPECTED_NOTICE);
        if (result.status === "notFound") {
          if (handling.notFound === undefined) notify(NOT_FOUND_NOTICE);
          else (handling.notFound as (input: Input) => void)(input);
        }
        return result;
      },
    });
    const run = useCallback(
      (input: Input) =>
        mutateAsync(input) as Promise<OperationResult<Output, Reason, FieldOf<Input>>>,
      [mutateAsync],
    );
    return { run, running: isPending };
  };
}
