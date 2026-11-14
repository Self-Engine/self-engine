import { Textarea, type TextareaProps, TextInput, type TextInputProps } from "@mantine/core";
import { type ChangeEvent, useCallback } from "react";
import { typedMemo, useFieldElement, useFieldMessage } from "./field-binding.ts";
import { bindingOf, type OperationForm } from "./operation-form.ts";

/** The fields of a draft that hold a text. */
export type TextFieldName<FormDraft> = {
  [Field in keyof FormDraft]: string extends FormDraft[Field] ? Field : never;
}[keyof FormDraft] &
  string;

/** What the helper sets on a bound field: the module leaves these out. */
type Bound = "name" | "value" | "defaultValue" | "onChange" | "error" | "form" | "ref";

interface TextBindingProps<FormDraft> {
  readonly form: OperationForm<FormDraft>;
  /** The field of the draft, and of the Operation's input, that the field shows. */
  readonly name: TextFieldName<FormDraft>;
}

export type TextFieldProps<FormDraft> = TextBindingProps<FormDraft> & Omit<TextInputProps, Bound>;
export type LongTextFieldProps<FormDraft> = TextBindingProps<FormDraft> &
  Omit<TextareaProps, Bound>;

/** The text a text field shows for a value of the draft. */
const textOf = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Writes a value set by code, or a stored value the field follows (D324), into the input. Where
 * the user's caret stands in it, it stays at the same place, or at the end of a shorter text.
 */
function writeKeepingTheCaret(element: HTMLInputElement | HTMLTextAreaElement, text: string) {
  if (element !== element.ownerDocument.activeElement) {
    element.value = text;
    return;
  }
  const { selectionStart, selectionEnd, selectionDirection } = element;
  element.value = text;
  if (selectionStart === null || selectionEnd === null) return;
  element.setSelectionRange(
    Math.min(selectionStart, text.length),
    Math.min(selectionEnd, text.length),
    selectionDirection ?? undefined,
  );
}

/**
 * Binds a Mantine text input to its field of the draft. The input keeps what is typed itself
 * (uncontrolled), so a key press redraws nothing; the field draws again only when its message or
 * the language changes. A value set by code is written into the input without a redraw.
 */
function useTextBinding<FormDraft>(form: OperationForm<FormDraft>, name: string) {
  const binding = bindingOf(form);
  const error = useFieldMessage(binding, name);
  const register = useFieldElement(binding, name);
  const ref = useCallback(
    (element: HTMLInputElement | HTMLTextAreaElement | null) => {
      if (element === null) return undefined;
      const unregister = register(element);
      const write = () => {
        // What the user typed is the value already; only a value set by code differs.
        const text = textOf(binding.valueOf(name));
        if (element.value !== text) writeKeepingTheCaret(element, text);
      };
      // An input that stays while its `name` or `form` changes shows the new field's value.
      write();
      const unsubscribe = binding.subscribeValue(name, write);
      return () => {
        unregister?.();
        unsubscribe();
      };
    },
    [binding, name, register],
  );
  return {
    ref,
    name,
    defaultValue: textOf(binding.valueOf(name)),
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      binding.change(name, event.currentTarget.value);
    },
    error,
  };
}

/** A single-line text of the draft, with its message from the check. */
export const TextField = typedMemo(function TextField<FormDraft>({
  form,
  name,
  ...props
}: TextFieldProps<FormDraft>) {
  return <TextInput {...props} {...useTextBinding(form, name)} />;
});

/** A multi-line text of the draft, with its message from the check; it grows with its text. */
export const LongTextField = typedMemo(function LongTextField<FormDraft>({
  form,
  name,
  ...props
}: LongTextFieldProps<FormDraft>) {
  return <Textarea autosize minRows={3} {...props} {...useTextBinding(form, name)} />;
});
