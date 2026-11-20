import { useLingui } from "@lingui/react/macro";
import { EditDrawerForm, TextField, useOperationForm } from "@self-engine/forms";
import type { IndicatorPanelProps } from "@self-engine/shell";
import { placeholderAlphaContract } from "../contracts/index.ts";
import { useCreateEntry } from "../port.ts";

/**
 * The Indicator Panel of the Shell's test subject: a note that becomes a new entry, in a form of
 * `forms`, which reports its unsaved changes here as it does in the Edit Drawer. The Shell gives
 * the panel its frame, its focus, its ways out and the question before changes are lost.
 */
export default function Panel({ onCancel, onDone }: IndicatorPanelProps) {
  const { t } = useLingui();
  const form = useOperationForm({
    entry: placeholderAlphaContract.create,
    operation: useCreateEntry(),
    draft: { name: "" },
    onDone,
  });
  return (
    <EditDrawerForm form={form} onCancel={onCancel}>
      <TextField form={form} label={t`Note`} name="name" />
    </EditDrawerForm>
  );
}
