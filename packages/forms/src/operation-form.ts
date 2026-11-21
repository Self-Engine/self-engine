import type { MessageDescriptor } from "@lingui/core";
import { useForm, type UseFormReturnType } from "@mantine/form";
import type { AnyContractProcedure, InferSchemaInput, InferSchemaOutput } from "@orpc/contract";
import {
  type DataAccess,
  type DeclaredInputReason,
  describeReasons,
  type InputIssue,
  type OperationResult,
  type OperationState,
  type Reason,
  type RunOptions,
  UNEXPECTED_NOTICE,
  useDataAccess,
} from "@self-engine/data-client/react";
import { useLayoutEffect, useRef, useState } from "react";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { $brand } from "zod/v4/core";
import { checkDraft, type FormTexts, type InputSchema, issueTexts } from "./check.ts";
import { FieldListeners } from "./field-listeners.ts";
import { FieldMessages, type FieldText } from "./field-messages.ts";
import { UnfinishedTexts } from "./unfinished-texts.ts";

/** The input that an entry of a Contract takes, as its input schema accepts it. */
export type InputOfEntry<Entry extends AnyContractProcedure> = InferSchemaInput<
  NonNullable<Entry["~orpc"]["inputSchema"]>
>;

/** The input of an entry as its input schema hands it on: where the schema brands, branded. */
type CheckedInputOfEntry<Entry extends AnyContractProcedure> = InferSchemaOutput<
  NonNullable<Entry["~orpc"]["inputSchema"]>
>;

// A draft may show a stored string a newer Contract no longer accepts (for example an icon).
type DraftValue<Value> = Value extends string ? string : Value;

/** The type of `Field` after the check, when the input schema brands it there; else `never`. */
type BrandedValue<Checked, Field> = Field extends keyof Checked
  ? [NonNullable<Checked[Field]>] extends [$brand]
    ? Checked[Field]
    : never
  : never;

/**
 * What a form holds while the user fills it in (D319): the field names and values of the
 * Operation's input. Every field may still be empty: an empty text is `""`, and a field without an
 * empty text, such as a picker, holds `null`.
 *
 * A value the input schema brands, such as a Calendar Day or an Instant of `time`, keeps its brand
 * here (D365), though the Operation's input takes plain text: `Checked` is the input as the schema
 * hands it on. So the compiler binds a date field to a day and never to a title. Every other text
 * is plain `string`.
 */
export type Draft<Input, Checked = Input> = {
  [Field in keyof Input]-?:
    | ([BrandedValue<Checked, Field>] extends [never]
        ? DraftValue<Input[Field]>
        : BrandedValue<Checked, Field>)
    | null;
};

/** The draft of a form that submits to `Entry`. */
export type DraftOfEntry<Entry extends AnyContractProcedure> = Draft<
  InputOfEntry<Entry>,
  CheckedInputOfEntry<Entry>
>;

/** Any result of an Operation hook (`OperationResult` of `@self-engine/data-client/react`). */
type AnyResult = OperationResult<unknown, string, string>;

/** The answer of an Operation that succeeded. */
type SuccessData<Result> = Result extends { readonly status: "success"; readonly data: infer Data }
  ? Data
  : never;

/**
 * The texts of a form of `Entry`: only those special to the module (D320), and a text for every
 * reason the entry declares for its own input errors (D369), which the compiler asks for.
 */
type TextsOption<Entry extends AnyContractProcedure> = [DeclaredInputReason<Entry>] extends [never]
  ? { readonly texts?: FormTexts<keyof InputOfEntry<Entry> & string> }
  : {
      readonly texts: FormTexts<keyof InputOfEntry<Entry> & string, DeclaredInputReason<Entry>>;
    };

export type OperationFormOptions<
  Entry extends AnyContractProcedure,
  Result extends AnyResult,
> = OperationFormBase<Entry, Result> & TextsOption<Entry>;

interface OperationFormBase<Entry extends AnyContractProcedure, Result extends AnyResult> {
  /**
   * The Contract entry the form submits to, such as `notesContract.create`. Its input schema
   * checks the draft (D317), so the module's Contract loads with the form, never at startup.
   */
  readonly entry: Entry;
  /** What the Operation hook of that entry returns, such as `useCreateNote()`. */
  readonly operation: OperationState<InputOfEntry<Entry>, Result>;
  /**
   * Creating: the draft the form starts with, read once, when the form first draws. Editing: the
   * stored entry as the Query answers it now, followed while the form is open (D324). A field the
   * user has not changed takes its new value; a changed one keeps its text, and "changed" is
   * compared with the new state. Give it on every draw; a new object with the same values does
   * nothing.
   */
  readonly draft: DraftOfEntry<Entry>;
  /** Editing compares against the stored entry and submits only changed fields plus identity. */
  readonly edit?: {
    /** Required routing keys (usually { id }); never counted as editable fields. */
    readonly identity: Partial<InputOfEntry<Entry>>;
    /**
     * Groups named beside the Contract rule; overlapping groups travel together. Name every group
     * a rule ties: a violation at a field the edit does not submit is reported as an error.
     */
    readonly tiedFields?: readonly (readonly (keyof InputOfEntry<Entry> & string)[])[];
    /**
     * The entry was deleted elsewhere (D324): the form keeps what it shows, tells the user and
     * cannot save, and `draft` is not followed, so give the last entry you had. Once it is `false`
     * again, after an undo, the form follows `draft` and saves as before. A module that deletes
     * the entry from inside its own form closes it and leaves this `false`.
     */
    readonly deleted?: boolean;
  };
  /** Nullable text fields: an empty or whitespace-only input hands on null, never empty text. */
  readonly emptyTextFields?: readonly (keyof InputOfEntry<Entry> & string)[];
  /**
   * The entry the form edits, by the name the person knows it by, such as its title: the Notice
   * of a refused save names it (D334). Give it once here; every save passes it on.
   */
  readonly entryName?: string;
  /** Called once the Operation succeeded, with its answer. */
  readonly onSuccess?: (data: SuccessData<Result>) => void;
  /** Closes the form after success or a not-found result. */
  readonly onDone?: () => void;
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
  /**
   * Sets the value of `field` by code, as if the user had chosen it: the field shows it, also a
   * bound picker, and any text the field held that was no value is gone.
   */
  setValue<Field extends keyof FormDraft & string>(field: Field, value: FormDraft[Field]): void;
  /** Only types the names a field may take; there is no such value. */
  readonly [draftOf]?: FormDraft;
}

/** What the fields of this package reach a form by; never part of the module's interface. */
export interface FormBinding {
  /** The value of `field` in the draft now. */
  readonly valueOf: (field: string) => unknown;
  /** Takes a finished value of `field` into the draft; any text it held that was no value is gone. */
  readonly change: (field: string, value: unknown) => void;
  /** Calls `listener` when the value of `field` changes, by the user or by code. */
  readonly subscribeValue: (field: string, listener: () => void) => () => void;
  /**
   * How many values reached `field` from outside it: set by code, or followed from the stored
   * entry (D324), also one equal to the value the draft holds. It changes before the listeners of
   * `subscribeValue` hear of it.
   */
  readonly setFromOutside: (field: string) => number;
  /** `field` holds text that is no value (D319); `message` shows once the user leaves it. */
  readonly holdUnfinished: (field: string, message: MessageDescriptor) => void;
  /** The focus left `field`. */
  readonly leave: (field: string) => void;
  /** The fields that hold text which is no value: it counts as an unsaved change too (#288). */
  readonly unfinished: Pick<UnfinishedTexts, "any" | "subscribe">;
  readonly messages: FieldMessages;
  readonly isChanged: () => boolean;
  readonly isEdit: boolean;
  /** Whether "Save" may submit: not while editing without a change, nor once the entry is deleted. */
  readonly canSubmit: () => boolean;
  /** The entry the form edits was deleted elsewhere (D324). */
  readonly isDeleted: () => boolean;
  /** Calls `listener` when `isChanged`, `canSubmit` or `isDeleted` may have changed. */
  readonly subscribeChanged: (listener: () => void) => () => void;
  readonly isRunning: () => boolean;
  readonly subscribeRunning: (listener: () => void) => () => void;
  /**
   * Gives the focus to the field a failed save named, once that field takes it: the body of the
   * form calls it when its lock ends, since a field inside the locked fieldset takes no focus.
   */
  readonly focusPending: () => void;
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
  /** The general notice, for an issue whose field changed before the form took it. */
  readonly notify: DataAccess["notify"];
  /** The shared Notice of a Refusal, for a Reason whose field changed before the form took it. */
  readonly notifyRefused: DataAccess["notifyRefused"];
  /** The options without the types that tie them to one entry. */
  readonly options: {
    readonly draft: Values;
    readonly edit?: {
      readonly identity: Values;
      readonly tiedFields?: readonly (readonly string[])[];
      readonly deleted?: boolean;
    };
    readonly emptyTextFields?: readonly string[];
    readonly entry: AnyContractProcedure;
    readonly entryName?: string;
    readonly texts?: FormTexts;
    readonly operation: {
      readonly run: (input: Values, options: RunOptions) => Promise<AnyResult>;
    };
    readonly onSuccess?: (data: unknown) => void;
    readonly onDone?: () => void;
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
): OperationForm<DraftOfEntry<Entry>> {
  const draft = useForm<Values>({ mode: "uncontrolled", initialValues: options.draft });
  const { notify, notifyRefused } = useDataAccess();
  // Read when the user acts, never while drawing: the latest Operation state and callback.
  const latest = useRef<Latest>({ draft, notify, notifyRefused, options } as unknown as Latest);
  const [{ form, follow }] = useState(() =>
    createForm(() => latest.current, options.edit !== undefined),
  );
  // Before the browser paints: no frame shows a field's old value beside the new entry (D324).
  useLayoutEffect(() => {
    latest.current = { draft, notify, notifyRefused, options } as unknown as Latest;
    follow();
  });
  return form;
}

interface MadeForm {
  readonly form: OperationForm<never>;
  /** Follows the stored entry of an edit after a draw, before it is painted (D324). */
  readonly follow: () => void;
}

function createForm(latest: () => Latest, isEdit: boolean): MadeForm {
  const messages = new FieldMessages();
  const values = new FieldListeners();
  const fromOutside = new Map<string, number>();
  const countFromOutside = (field: string) =>
    fromOutside.set(field, (fromOutside.get(field) ?? 0) + 1);
  const unfinished = new UnfinishedTexts();
  const conflicts = new Map<string, MessageDescriptor>();
  // The Reasons of the last refused save at the fields the Operation maps their columns to (D334).
  const refusedAt = new Map<string, FieldText>();
  // The input error of the last save, at the fields its issues name (D369).
  const invalidAt = new Map<string, MessageDescriptor>();
  // The field a failed save named, until it takes the focus.
  let focusField: string | undefined;
  const focusPending = () => {
    const element = focusField === undefined ? undefined : elements.get(focusField);
    if (element !== undefined && focusInto(element)) focusField = undefined;
  };
  const elements = new Map<string, HTMLElement>();
  const changedListeners = new Set<() => void>();
  const normalize = (values: Values): Values => {
    const result = { ...values };
    for (const field of latest().options.emptyTextFields ?? []) {
      if (typeof result[field] === "string" && result[field].trim() === "") result[field] = null;
    }
    return result;
  };
  const normalized = () => normalize(latest().draft.getValues());
  // The stored state "changed" compares with, apart from the draft: it follows the entry (D324).
  let stored: Values = structuredClone(normalized());
  // The stored entry as the module gave it last, to notice when it gives another.
  let followed: unknown = structuredClone(latest().options.draft);
  let deleted = false;
  const changedFields = () => {
    const current = normalized();
    return Object.keys(stored).filter(
      (field) =>
        !Object.hasOwn(latest().options.edit?.identity ?? {}, field) &&
        !sameValue(current[field], stored[field]),
    );
  };
  const isChanged = () => unfinished.any() || changedFields().length > 0;
  const canSubmit = () => latest().options.edit === undefined || (!deleted && isChanged());
  const notifyChanged = () => {
    for (const listener of changedListeners) listener();
  };
  unfinished.subscribe(notifyChanged);
  const input = (): Values => {
    const draft = normalized();
    const edit = latest().options.edit;
    if (edit === undefined) return draft;
    const fields = new Set(changedFields());
    // Closure handles overlapping rules (a/b and b/c must send a/b/c).
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const group of edit.tiedFields ?? []) {
        if (!group.some((field) => fields.has(field))) continue;
        for (const field of group) {
          if (!fields.has(field)) {
            fields.add(field);
            expanded = true;
          }
        }
      }
    }
    return {
      ...Object.fromEntries([...fields].map((field) => [field, draft[field]])),
      ...edit.identity,
    };
  };
  let running = false;
  const runningListeners = new Set<() => void>();
  const setRunning = (value: boolean) => {
    running = value;
    for (const listener of runningListeners) listener();
  };
  // From the first failed save on, every change checks the whole draft (D321).
  let checkingEveryChange = false;
  let violations: ReadonlyMap<string, MessageDescriptor> = new Map();
  // A violation outranks a Conflict or a Reason at the same field, and a field's text that is no
  // value outranks what the schema says of its older value.
  const show = () =>
    messages.replace(
      new Map<string, FieldText>([
        ...conflicts,
        ...refusedAt,
        ...invalidAt,
        ...violations,
        ...unfinished.shown(),
      ]),
    );
  const check = (): ReadonlyMap<string, MessageDescriptor> => {
    const { options } = latest();
    violations = checkDraft(inputSchemaOf(options.entry), input(), options.texts);
    show();
    return violations;
  };
  // A Conflict or a Reason at the field is answered by any change to it, also text that is no
  // value yet; whether one stood there.
  const answerAt = (field: string) => {
    const hadConflict = conflicts.delete(field);
    const hadReason = refusedAt.delete(field);
    const hadIssue = invalidAt.delete(field);
    return hadConflict || hadReason || hadIssue;
  };
  const change = (field: string, value: unknown) => {
    // Without the forced update: the field already shows what was typed.
    latest().draft.setFieldValue(field, value, { forceUpdate: false });
    const wasUnfinished = unfinished.finish(field);
    const answered = answerAt(field);
    values.notify(field);
    notifyChanged();
    if (checkingEveryChange || answered) check();
    else if (wasUnfinished) show();
  };
  const follow = () => {
    const { draft, options } = latest();
    if (options.edit === undefined) return;
    const gone = options.edit.deleted === true;
    let followedNow = gone !== deleted;
    let answered = false;
    deleted = gone;
    if (!gone && !sameValue(options.draft, followed)) {
      followed = structuredClone(options.draft);
      const current = normalized();
      const next = normalize(options.draft);
      // A field the user has not changed takes the new value; a changed one keeps its text.
      const taking = Object.keys(next).filter(
        (field) =>
          !unfinished.holds(field) &&
          sameValue(current[field], stored[field]) &&
          !sameValue(current[field], next[field]),
      );
      for (const field of taking) {
        draft.setFieldValue(field, options.draft[field], { forceUpdate: false });
        countFromOutside(field);
      }
      // A field that takes a new value changed, as by the user or by code: that answers what
      // stood at it.
      answered = taking.filter(answerAt).length > 0;
      stored = structuredClone(next);
      for (const field of taking) values.notify(field);
      followedNow = true;
    }
    if (!followedNow) return;
    notifyChanged();
    if (checkingEveryChange || answered) check();
  };
  const form: OperationForm<never> = {
    async submit() {
      if (running || !canSubmit()) return;
      focusField = undefined;
      unfinished.reportAll();
      const found = check();
      const blocked = new Set([...found.keys(), ...unfinished.shown().keys()]);
      if (blocked.size > 0) {
        checkingEveryChange = true;
        reportMisplaced(found, elements, latest().options.edit === undefined ? undefined : input());
        const first = firstOnScreen(blocked, elements);
        if (first !== undefined) focusInto(first);
        return;
      }
      const { options } = latest();
      setRunning(true);
      try {
        // What this save hands on: a value set while it runs was never sent and stays changed.
        const sent = structuredClone(input());
        // The draft as this save sent it, to tell which fields changed while it ran.
        const drafted = structuredClone(normalized());
        // A Reason goes to a field only if this form shows that field and the field still holds
        // what was sent: a change while the save ran, also to text that is no value yet, answered
        // it already. The Notice tells the rest.
        const showsAsSent = (field: string) =>
          elements.has(field) &&
          !unfinished.holds(field) &&
          sameValue(normalized()[field], drafted[field]);
        const entry = options.entryName === undefined ? {} : { entry: options.entryName };
        const result = await options.operation.run(sent, { ...entry, showsField: showsAsSent });
        // Every answer replaces the Reasons of the last refused save and the issues of the last
        // invalid one: they spoke of that save.
        const hadReasons = refusedAt.size > 0 || invalidAt.size > 0;
        refusedAt.clear();
        invalidAt.clear();
        if (result.status === "invalid") {
          // As for a Reason: an issue whose field changed meanwhile goes to the general notice.
          const atFields = result.atFields.filter(({ field }) => showsAsSent(field));
          for (const [field, text] of textsOf(atFields, drafted, options.texts)) {
            invalidAt.set(field, text);
          }
          if (atFields.length < result.atFields.length) latest().notify(UNEXPECTED_NOTICE);
          // The first such field on screen takes the focus, once the lock of the save ends.
          const first = firstOnScreen(invalidAt.keys(), elements);
          focusField = [...invalidAt.keys()].find((field) => elements.get(field) === first);
        }
        if (result.status === "refused") {
          // The hook told every other Reason in its Notice. A field can change, or go, between
          // the hook's answer and this moment, such as by code the Notice runs: asked again here,
          // a Reason that no longer describes its field goes to a Notice of its own.
          const atFields = result.atFields.filter(({ field }) => showsAsSent(field));
          for (const [field, text] of reasonsAtFields(atFields)) {
            refusedAt.set(field, text);
          }
          const elsewhere = result.atFields.filter((at) => !atFields.includes(at));
          if (elsewhere.length > 0)
            latest().notifyRefused({ reasons: elsewhere.map(({ reason }) => reason), ...entry });
        }
        if (result.status === "conflict" && result.field !== null) {
          conflicts.set(result.field, result.text);
        }
        if (
          result.status === "refused" ||
          result.status === "invalid" ||
          (result.status === "conflict" && result.field !== null)
        )
          check();
        else if (hadReasons) show();
        if (result.status === "success") {
          stored = { ...stored, ...structuredClone(sent) };
          notifyChanged();
          latest().options.onSuccess?.(result.data);
        }
        if (result.status === "success" || result.status === "notFound")
          latest().options.onDone?.();
      } finally {
        setRunning(false);
      }
      // A form without the shared body has no lock, and its field takes the focus now.
      focusPending();
    },
    setValue(field, value) {
      // Also a value the draft holds already reaches the field, which drops any text it holds.
      countFromOutside(field);
      change(field, value);
    },
  };
  BINDINGS.set(form, {
    valueOf: (field) => latest().draft.getValues()[field],
    change,
    subscribeValue: (field, listener) => values.subscribe(field, listener),
    setFromOutside: (field) => fromOutside.get(field) ?? 0,
    holdUnfinished(field, message) {
      unfinished.hold(field, message);
      // Its message waits until the user leaves the field, as before; the answered one goes now.
      if (answerAt(field)) check();
      else show();
    },
    leave(field) {
      unfinished.report(field);
      show();
    },
    unfinished,
    messages,
    isChanged,
    isEdit,
    canSubmit,
    isDeleted: () => deleted,
    subscribeChanged(listener) {
      changedListeners.add(listener);
      return () => changedListeners.delete(listener);
    },
    isRunning: () => running,
    focusPending,
    subscribeRunning(listener) {
      runningListeners.add(listener);
      return () => {
        runningListeners.delete(listener);
      };
    },
    register(field, element) {
      elements.set(field, element);
      return () => {
        if (elements.get(field) === element) elements.delete(field);
      };
    },
  });
  return { form, follow };
}

/**
 * The text each field shows for the Reasons at it: several at one field read one after the other,
 * as the shared Notice words them. Each text is built while the field shows it, in the language
 * and with the Reason texts of the moment.
 */
function reasonsAtFields(
  atFields: readonly { readonly field: string; readonly reason: Reason }[],
): ReadonlyMap<string, FieldText> {
  const byField = Map.groupBy(atFields, ({ field }) => field);
  return new Map(
    [...byField].map(([field, at]) => [
      field,
      (i18n, reasonTexts) =>
        describeReasons(
          reasonTexts,
          at.map(({ reason }) => reason),
          i18n,
        ),
    ]),
  );
}

function inputSchemaOf(entry: AnyContractProcedure): InputSchema {
  const schema = entry["~orpc"].inputSchema;
  if (schema === undefined) throw new Error("A form submits to a Contract entry with an input");
  return schema;
}

/** Of the fields with a message, the one that comes first on screen. */
function firstOnScreen(
  fields: Iterable<string>,
  elements: ReadonlyMap<string, HTMLElement>,
): HTMLElement | undefined {
  const shown = [...fields].flatMap((field) => elements.get(field) ?? []);
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
 * The text at each field of an input error's issues, the way the form's own check words them
 * (D369): the Operation's issues have the shape of the input schema's.
 */
function textsOf(
  issues: readonly InputIssue[],
  draft: Values,
  texts: FormTexts | undefined,
): ReadonlyMap<string, MessageDescriptor> {
  const asSchemaIssues = issues.map(
    ({ issue, path }) => ({ message: "", ...issue, path }) as StandardSchemaV1.Issue,
  );
  return issueTexts(asSchemaIssues, draft, texts ?? {}, "The Operation");
}

/**
 * Focuses a field: its element where that takes the focus, such as a text input, else the first
 * element inside it that does, such as the button of a picker or its chosen radio. Whether one
 * took it: inside a locked form, none does.
 */
function focusInto(field: HTMLElement): boolean {
  const takesFocus = (element: HTMLElement) =>
    element.tabIndex >= 0 && !element.matches(":disabled");
  const target = takesFocus(field)
    ? field
    : [...field.querySelectorAll<HTMLElement>("*")].find(takesFocus);
  target?.focus();
  return target !== undefined;
}

/**
 * Programming errors of a module, reported so that a story fails on them (ADR 0012): a violation
 * at a name no field shows blocks the save without a word, and one at a field an edit does not
 * `submitted` comes from a rule whose tied fields `edit.tiedFields` misses, and its message is
 * wrong for what the field shows.
 */
function reportMisplaced(
  found: ReadonlyMap<string, MessageDescriptor>,
  elements: ReadonlyMap<string, HTMLElement>,
  submitted: Values | undefined,
): void {
  for (const field of found.keys()) {
    if (!elements.has(field)) {
      console.error(
        `The input schema reports "${field}", but the form shows no field of that name: the save is blocked without a message.`,
      );
    } else if (submitted !== undefined && !Object.hasOwn(submitted, field.split(".")[0] ?? "")) {
      console.error(
        `The input schema reports "${field}", but this edit does not submit it: name the fields its rule ties in edit.tiedFields.`,
      );
    }
  }
}

/** Contract values are data: compare their contents rather than object identity. */
function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null)
    return false;
  if (left instanceof Date || right instanceof Date)
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) && sameValue(Reflect.get(left, key), Reflect.get(right, key)),
    )
  );
}
