import { useLingui } from "@lingui/react";
import { Textarea, type TextareaProps, TextInput, type TextInputProps } from "@mantine/core";
import { type ChangeEvent, memo, useCallback, useSyncExternalStore } from "react";
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

/**
 * Binds a Mantine text input to its field of the draft. The input keeps what is typed itself
 * (uncontrolled), so a key press redraws nothing; the field draws again only when its message or
 * the language changes.
 */
function useTextBinding<FormDraft>(form: OperationForm<FormDraft>, name: string) {
  const binding = bindingOf(form);
  const message = useSyncExternalStore(
    useCallback(
      (listener: () => void) => binding.messages.subscribe(name, listener),
      [binding, name],
    ),
    () => binding.messages.of(name),
  );
  const { i18n } = useLingui();
  const ref = useCallback(
    (element: HTMLElement | null) =>
      element === null ? undefined : binding.register(name, element),
    [binding, name],
  );
  const value = binding.valueOf(name);
  return {
    ref,
    name,
    defaultValue: typeof value === "string" ? value : "",
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      binding.change(name, event.currentTarget.value);
    },
    error: message && i18n._(message),
  };
}

/**
 * `memo` for a generic component: a field draws again only when its own props change, not when
 * the module's form around it does, such as when the form library notes the first change.
 */
const typedMemo = memo as <Component>(component: Component) => Component;

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
