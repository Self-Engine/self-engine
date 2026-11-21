import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { useReasonTexts } from "@self-engine/data-client/react";
import { memo, useCallback, useMemo, useSyncExternalStore } from "react";
import type { $brand } from "zod/v4/core";
import { textOf } from "./field-messages.ts";
import { bindingOf, type FormBinding, type OperationForm } from "./operation-form.ts";
import { UNFINISHED } from "./unfinished-texts.ts";

/** The names of a draft's fields. */
export type FieldName<FormDraft> = keyof FormDraft & string;

/**
 * A field that knows only `value` and `onChange`, such as a picker, bound to its field of the
 * draft (D319). What it gives `onChange` is the finished value; text the user is still typing
 * stays in the field, which reports it with `onUnfinished`.
 */
export interface FieldBinding<Value> {
  /** The field's value in the draft; the field draws again when it changes, also by code. */
  readonly value: Value;
  /**
   * Changes whenever a value reaches the field from outside it: set by code, or followed from the
   * stored entry (D324), also when it equals `value`. A field that keeps its own text replaces it
   * with `value` then; its own `onChange` leaves this as it is.
   */
  readonly setFromOutside: number;
  /** Hands on a finished value, `null` for "empty"; any text the field held that was no value is gone. */
  readonly onChange: (value: Value) => void;
  /**
   * The field holds text that is no value, such as "25:00" for a time: the save is blocked, and
   * `message` shows once the user leaves the field or tries to save, until `onChange` hands on a
   * finished value. Without `message` the helper's text shows.
   */
  readonly onUnfinished: (message?: MessageDescriptor) => void;
  /** For the field's `onBlur`: the focus left it. */
  readonly onBlur: () => void;
  /** The message the field shows, translated, such as for Mantine's `error`; else `undefined`. */
  readonly error: string | undefined;
  /**
   * For the field's outermost element: it places the field among the others on screen, and a
   * failed save focuses it, or the first element inside it that takes the focus.
   */
  readonly ref: (element: HTMLElement | null) => (() => void) | undefined;
}

/**
 * Binds a field that knows only `value` and `onChange` to its field of the draft: a picker of
 * `ui`, or a module's own one, such as the project picker of `projects`. The field draws again
 * only when its value, its message or the language changes. Write the field as a component in
 * `typedMemo` whose props stay the same, so that a change elsewhere in the form redraws it not.
 *
 * ```tsx
 * const ProjectField = typedMemo(function ProjectField<FormDraft>({ form, name }: …) {
 *   const field = useFieldBinding(form, name);
 *   return <ProjectPicker ref={field.ref} value={field.value} onChange={field.onChange} error={field.error} />;
 * });
 * ```
 */
export function useFieldBinding<FormDraft, Name extends FieldName<FormDraft>>(
  form: OperationForm<FormDraft>,
  name: Name,
): FieldBinding<FormDraft[Name]> {
  const binding = bindingOf(form);
  const value = useSyncExternalStore(
    useCallback((listener: () => void) => binding.subscribeValue(name, listener), [binding, name]),
    () => binding.valueOf(name),
  ) as FormDraft[Name];
  const setFromOutside = useSyncExternalStore(
    useCallback((listener: () => void) => binding.subscribeValue(name, listener), [binding, name]),
    () => binding.setFromOutside(name),
  );
  const error = useFieldMessage(binding, name);
  const ref = useFieldElement(binding, name);
  const handlers = useMemo(
    () => ({
      onChange: (next: FormDraft[Name]) => {
        binding.change(name, next);
      },
      onUnfinished: (message: MessageDescriptor = UNFINISHED) => {
        binding.holdUnfinished(name, message);
      },
      onBlur: () => {
        binding.leave(name);
      },
    }),
    [binding, name],
  );
  return { value, setFromOutside, error, ref, ...handlers };
}

/**
 * The fields of a draft that may hold everything `Picked` answers, not only a part of it. Where
 * `Picked` is branded, such as a Calendar Day or a project's id, the field holds nothing wider
 * either (D365): a draft keeps the brands of its Contract, so a date field binds to a day and
 * never to a title.
 */
export type FieldTaking<FormDraft, Picked> = {
  [Field in FieldName<FormDraft>]: [Picked] extends [FormDraft[Field]]
    ? [NonNullable<Picked>] extends [$brand]
      ? [Exclude<FormDraft[Field], undefined>] extends [Picked]
        ? Field
        : never
      : Field
    : never;
}[FieldName<FormDraft>];

/** The binding of a field that hands on `Taken`; it reads the draft's value as it stands. */
export interface TakingBinding<Taken> extends Omit<FieldBinding<unknown>, "onChange"> {
  readonly onChange: (value: Taken) => void;
}

/**
 * `useFieldBinding` for a field that hands on `Taken`, such as a picker of `ProjectId | null` or
 * the two Instants of the field "date, start, end": its `onChange` takes `Taken` without a cast
 * at the field.
 */
export function useFieldTaking<FormDraft, Taken>(
  form: OperationForm<FormDraft>,
  name: FieldTaking<FormDraft, Taken>,
): TakingBinding<Taken> {
  const field = useFieldBinding(form, name);
  // `FieldTaking` admits only a field whose draft type takes `Taken`, but the compiler cannot
  // follow that through the mapped type for a draft it does not know yet. The cast gives up no
  // check: a name outside `FieldTaking` is still rejected where the field is used.
  return field as TakingBinding<Taken>;
}

/**
 * The message of `field`, translated; the field draws again only when it, the language or the
 * provider's Reason texts change.
 */
export function useFieldMessage(binding: FormBinding, field: string): string | undefined {
  const message = useSyncExternalStore(
    useCallback(
      (listener: () => void) => binding.messages.subscribe(field, listener),
      [binding, field],
    ),
    () => binding.messages.of(field),
  );
  const { i18n } = useLingui();
  // Read here, like the language: new texts reach a Reason this field already shows.
  const reasonTexts = useReasonTexts();
  return message && textOf(message, i18n, reasonTexts);
}

/** The callback ref that registers the element of `field` with the form. */
export function useFieldElement(
  binding: FormBinding,
  field: string,
): (element: HTMLElement | null) => (() => void) | undefined {
  return useCallback(
    (element: HTMLElement | null) =>
      element === null ? undefined : binding.register(field, element),
    [binding, field],
  );
}

/**
 * `memo` for a generic component: a field draws again only when its own props change, not when
 * the module's form around it does, such as when the form library notes the first change.
 */
export const typedMemo = memo as <Component>(component: Component) => Component;
