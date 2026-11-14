// The pickers of `ui` as fields of a form (D319, D326): the field for icon and emoji, and the
// color. The pickers stay in `ui` and know nothing of a form; each field here binds one to its
// field of the draft. Neither picker can hold text that is no value: the emoji search keeps what
// is typed and hands on only a finished emoji.

import {
  EntryColorPicker,
  type EntryColorPickerProps,
  EntryIconPicker,
  type EntryIconPickerProps,
} from "@self-engine/ui/entry-pickers";
import { type FieldName, typedMemo, useFieldBinding } from "./field-binding.ts";
import type { OperationForm } from "./operation-form.ts";

/** What a picker answers: a Color Set name, or `null` for "no color". */
type ColorChoice = Parameters<EntryColorPickerProps["onChange"]>[0];

/** The fields of a draft that may hold everything `Picked` answers, not only a part of it. */
type FieldTaking<FormDraft, Picked> = {
  [Field in FieldName<FormDraft>]: [Picked] extends [FormDraft[Field]] ? Field : never;
}[FieldName<FormDraft>];

/** What the helper sets on a bound picker: the module leaves these out. */
type Bound = "value" | "onChange" | "error";

export type IconFieldProps<FormDraft> = {
  readonly form: OperationForm<FormDraft>;
  /** The field of the draft that holds the icon name or the emoji. */
  readonly name: FieldTaking<FormDraft, string | null>;
} & Omit<EntryIconPickerProps, Bound>;

export type ColorFieldProps<FormDraft> = {
  readonly form: OperationForm<FormDraft>;
  /** The field of the draft that holds the Color Set name. */
  readonly name: FieldTaking<FormDraft, ColorChoice>;
} & Omit<EntryColorPickerProps, Bound>;

/** The icon or emoji of an entry, with its message from the check; "No icon" hands on "empty". */
export const IconField = typedMemo(function IconField<FormDraft>({
  form,
  name,
  ...props
}: IconFieldProps<FormDraft>) {
  const field = useFieldBinding(form, name);
  return (
    <div ref={field.ref}>
      <EntryIconPicker
        {...props}
        error={field.error}
        onChange={field.onChange as (icon: string | null) => void}
        value={field.value as string | null}
      />
    </div>
  );
});

/** The color of an entry, with its message from the check; "No color" hands on "empty". */
export const ColorField = typedMemo(function ColorField<FormDraft>({
  form,
  name,
  ...props
}: ColorFieldProps<FormDraft>) {
  const field = useFieldBinding(form, name);
  return (
    <div ref={field.ref}>
      <EntryColorPicker
        {...props}
        error={field.error}
        onChange={field.onChange as (color: ColorChoice) => void}
        value={field.value as string | null}
      />
    </div>
  );
});
