import { useLingui } from "@lingui/react/macro";
import { Button } from "@mantine/core";
import {
  ColorField,
  EditDrawerForm,
  IconField,
  LongTextField,
  TextField,
  useOperationForm,
} from "@self-engine/forms";
import { type EditDrawerProps, useEditDrawerTitle } from "@self-engine/shell";
import { ErrorState } from "@self-engine/ui";
import { projectsContract } from "./contracts/index.ts";
import { NEW_PROJECT_ID } from "./project-address.ts";
import { useCreateProject } from "./port.ts";

/**
 * The Edit Drawer of `projects`. It loads on demand with the Contract, whose input schema the form
 * checks with (D317). Editing a stored project comes with #303; until then any other address is
 * one the drawer does not know.
 */
export default function EditDrawer(props: EditDrawerProps) {
  if (props.id === NEW_PROJECT_ID) return <CreateForm {...props} />;
  return <NotFound {...props} />;
}

function NotFound({ onDone }: EditDrawerProps) {
  const { t } = useLingui();
  return (
    <ErrorState
      title={t`Project not found`}
      action={
        <Button onClick={onDone} variant="default">
          {t({ message: "Close", context: "Close the drawer" })}
        </Button>
      }
    />
  );
}

function CreateForm({ onCancel, onDone }: EditDrawerProps) {
  const { t } = useLingui();
  useEditDrawerTitle(t`New project`);
  const form = useOperationForm({
    entry: projectsContract.create,
    operation: useCreateProject(),
    draft: { title: "", description: "", icon: null, color: null },
    emptyTextFields: ["description"],
    onDone,
  });
  return (
    <EditDrawerForm form={form} onCancel={onCancel}>
      <TextField form={form} name="title" label={t`Title`} />
      <LongTextField form={form} name="description" label={t`Description`} />
      <IconField form={form} name="icon" label={t`Icon`} />
      <ColorField form={form} name="color" label={t`Color`} />
    </EditDrawerForm>
  );
}
