import type { MessageDescriptor } from "@lingui/core";
import { useForm, type UseFormReturnType } from "@mantine/form";
import type { AnyContractProcedure, InferSchemaInput } from "@orpc/contract";
import type { OperationState } from "@self-engine/data-client/react";
import { useEffect, useRef, useState } from "react";
import { checkDraft, type InputSchema } from "./check.ts";
import { FieldMessages } from "./field-messages.ts";

/** The input that an entry of a Contract takes, as its input schema accepts it. */
export type InputOfEntry<Entry extends AnyContractProcedure> = InferSchemaInput<
  NonNullable<Entry["~orpc"]["inputSchema"]>
>;

/**
 * What a form holds while the user fills it in (D319): the field names and values of the
 * Operation's input. Every field may still be empty: an empty text is `""`, and a field without an
 * empty text, such as a picker, holds `null`.
 */
export type Draft<Input> = { [Field in keyof Input]-?: Input[Field] | null };

/** Any result of an Operation hook (`OperationResult` of `@self-engine/data-client/react`). */
interface AnyResult {
  readonly status: string;
}

/** The answer of an Operation that succeeded. */
type SuccessData<Result> = Result extends { readonly status: "success"; readonly data: infer Data }
  ? Data
  : never;

export interface OperationFormOptions<
  Entry extends AnyContractProcedure,
  Result extends AnyResult,
> {
  /**
   * The Contract entry the form submits to, such as `notesContract.create`. Its input schema
   * checks the draft (D317), so the module's Contract loads with the form, never at startup.
   */
  readonly entry: Entry;
  /** What the Operation hook of that entry returns, such as `useCreateNote()`. */
  readonly operation: OperationState<InputOfEntry<Entry>, Result>;
  /** The draft the form starts with; read once, when the form first draws. */
  readonly draft: Draft<InputOfEntry<Entry>>;
  /** Called once the Operation succeeded, with its answer. */
  readonly onSuccess?: (data: SuccessData<Result>) => void;
}

declare const draftOf: unique symbol;

/** A form as a module holds it: its fields take it, and its button submits it. */
export interface OperationForm<FormDraft> {
  /**
   * Checks the draft with the input schema. With violations it calls no Operation, shows every
   * message at its field and focuses the first such field on screen; from then on every change
   * checks the whole draft again (D321). Without, it calls the Operation with the draft.
   */
  readonly submit: () => Promise<void>;
  /** Only types the names a field may take; there is no such value. */
  readonly [draftOf]?: FormDraft;
}

/** What the fields of this package reach a form by; never part of the module's interface. */
export interface FormBinding {
  /** The value of `field` in the draft now. */
  readonly valueOf: (field: string) => unknown;
  /** Takes a finished value of `field` into the draft. */
  readonly change: (field: string, value: unknown) => void;
  readonly messages: FieldMessages;
  /** Makes `element` the one the focus goes to for `field`; returns the function that undoes it. */
  readonly register: (field: string, element: HTMLElement) => () => void;
}

const BINDINGS = new WeakMap<OperationForm<unknown>, FormBinding>();

/** How a field of this package reaches its form. */
export function bindingOf(form: OperationForm<unknown>): FormBinding {
  const binding = BINDINGS.get(form);
  if (binding === undefined) throw new Error("A field needs a form made by useOperationForm");
  return binding;
}

type Values = Record<string, unknown>;

interface Latest {
  readonly draft: UseFormReturnType<Values>;
  /** The options without the types that tie them to one entry. */
  readonly options: {
    readonly entry: AnyContractProcedure;
    readonly operation: { readonly run: (input: Values) => Promise<AnyResult> };
    readonly onSuccess?: (data: unknown) => void;
  };
}

/**
 * A form that submits its draft to one Operation (D317–D322). The draft lives in the form library
 * in uncontrolled mode, outside React's state, so typing redraws nothing, and each field hears
 * only of its own message (D318).
 *
 * ```tsx
 * const form = useOperationForm({
 *   entry: notesContract.create,
 *   operation: useCreateNote(),
 *   draft: { title: "", text: "" },
 *   onSuccess: onDone,
 * });
 * <TextField form={form} name="title" label={t`Title`} />
 * ```
 */
export function useOperationForm<Entry extends AnyContractProcedure, Result extends AnyResult>(
  options: OperationFormOptions<Entry, Result>,
): OperationForm<Draft<InputOfEntry<Entry>>> {
  const draft = useForm<Values>({ mode: "uncontrolled", initialValues: options.draft });
  // Read when the user acts, never while drawing: the latest Operation state and callback.
  const latest = useRef<Latest>({ draft, options } as unknown as Latest);
  useEffect(() => {
    latest.current = { draft, options } as unknown as Latest;
  });
  const [form] = useState(() => createForm(() => latest.current));
  return form;
}

function createForm(latest: () => Latest): OperationForm<never> {
  const messages = new FieldMessages();
  const elements = new Map<string, HTMLElement>();
  // From the first failed save on, every change checks the whole draft (D321).
  let checkingEveryChange = false;
  const check = (): ReadonlyMap<string, MessageDescriptor> => {
    const { draft, options } = latest();
    const found = checkDraft(inputSchemaOf(options.entry), draft.getValues());
    messages.replace(found);
    return found;
  };
  const form: OperationForm<never> = {
    async submit() {
      const found = check();
      if (found.size > 0) {
        checkingEveryChange = true;
        reportFieldsMissing(found, elements);
        firstOnScreen(found, elements)?.focus();
        return;
      }
      const { draft, options } = latest();
      const result = await options.operation.run(draft.getValues());
      if (result.status === "success") latest().options.onSuccess?.(Reflect.get(result, "data"));
    },
  };
  BINDINGS.set(form, {
    valueOf: (field) => latest().draft.getValues()[field],
    change(field, value) {
      // Without the forced update: the field already shows what was typed.
      latest().draft.setFieldValue(field, value, { forceUpdate: false });
      if (checkingEveryChange) check();
    },
    messages,
    register(field, element) {
      elements.set(field, element);
      return () => {
        if (elements.get(field) === element) elements.delete(field);
      };
    },
  });
  return form;
}

function inputSchemaOf(entry: AnyContractProcedure): InputSchema {
  const schema = entry["~orpc"].inputSchema;
  if (schema === undefined) throw new Error("A form submits to a Contract entry with an input");
  return schema;
}

/** Of the fields with a message, the one that comes first on screen. */
function firstOnScreen(
  found: ReadonlyMap<string, MessageDescriptor>,
  elements: ReadonlyMap<string, HTMLElement>,
): HTMLElement | undefined {
  const shown = [...found.keys()].flatMap((field) => elements.get(field) ?? []);
  return shown.reduce<HTMLElement | undefined>(
    (first, element) =>
      first === undefined ||
      (element.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        ? element
        : first,
    undefined,
  );
}

/**
 * A violation at a name no field shows would block the save without a word, so it is reported:
 * a story fails on it (ADR 0012).
 */
function reportFieldsMissing(
  found: ReadonlyMap<string, MessageDescriptor>,
  elements: ReadonlyMap<string, HTMLElement>,
): void {
  for (const field of found.keys()) {
    if (elements.has(field)) continue;
    console.error(
      `The input schema reports "${field}", but the form shows no field of that name: the save is blocked without a message.`,
    );
  }
}
