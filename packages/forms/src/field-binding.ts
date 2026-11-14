import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { memo, useCallback, useMemo, useSyncExternalStore } from "react";
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

/** The message of `field`, translated; the field draws again only when it or the language changes. */
export function useFieldMessage(binding: FormBinding, field: string): string | undefined {
  const message = useSyncExternalStore(
    useCallback(
      (listener: () => void) => binding.messages.subscribe(field, listener),
      [binding, field],
    ),
    () => binding.messages.of(field),
  );
  const { i18n } = useLingui();
  return message && i18n._(message);
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
