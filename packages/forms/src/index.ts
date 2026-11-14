// The form helper (D317–D325): every module builds its forms with it, and only this package
// imports the form library. Nothing at startup imports it: a form loads with its Edit Drawer.
export { type FieldBinding, type FieldName, typedMemo, useFieldBinding } from "./field-binding.ts";
export {
  type Draft,
  type InputOfEntry,
  type OperationForm,
  type OperationFormOptions,
  useOperationForm,
} from "./operation-form.ts";
export {
  ColorField,
  type ColorFieldProps,
  type FieldTaking,
  IconField,
  type IconFieldProps,
} from "./picker-fields.tsx";
export {
  LongTextField,
  type LongTextFieldProps,
  TextField,
  type TextFieldName,
  type TextFieldProps,
} from "./text-fields.tsx";
export {
  EditDrawerForm,
  type EditDrawerFormProps,
  OperationFormBody,
  type OperationFormBodyProps,
} from "./form-body.tsx";

export type { FormTexts } from "./check.ts";
