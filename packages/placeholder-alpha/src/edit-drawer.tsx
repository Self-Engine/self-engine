import { useLingui } from "@lingui/react/macro";
import { Button, Text } from "@mantine/core";
import {
  EditDrawerForm,
  TextField,
  useOperationForm,
  type OperationForm,
} from "@self-engine/forms";
import { type EditDrawerProps, useEditDrawerTitle } from "@self-engine/shell";
import { ErrorState, QueryStateBlock } from "@self-engine/ui";
import { useState } from "react";
import { placeholderAlphaContract } from "./contracts/index.ts";
import { useDeleteWithUndo } from "./delete-with-undo.tsx";
import { NEW_ENTRY_ID } from "./entry-address.ts";
import { ALL_ENTRIES, type Entry, useCreateEntry, useEntries, useRenameEntry } from "./port.ts";

export default function EditDrawer(props: EditDrawerProps) {
  const list = useEntries(ALL_ENTRIES);
  if (props.id === NEW_ENTRY_ID) return <CreateForm {...props} />;
  return (
    <QueryStateBlock state={list}>
      {(entries) => (
        <StoredEntryDrawer {...props} found={entries.find((entry) => entry.id === props.id)} />
      )}
    </QueryStateBlock>
  );
}

function StoredEntryDrawer({
  found,
  ...props
}: EditDrawerProps & { readonly found: Entry | undefined }) {
  const { t } = useLingui();
  const remove = useDeleteWithUndo();
  const [last, setLast] = useState(found);
  if (found !== undefined && found !== last) setLast(found);
  const [deletedHere, setDeletedHere] = useState(false);
  const entry = found ?? last;
  if (entry === undefined)
    return (
      <ErrorState
        title={t`Entry not found`}
        action={
          <Button onClick={props.onDone} variant="default">
            {t({ message: "Close", context: "Close the drawer" })}
          </Button>
        }
      />
    );
  return (
    <RenameForm
      {...props}
      entry={entry}
      deleted={found === undefined && !deletedHere}
      onDelete={() => {
        // Keep the entry through the closing transition (#132), without the deleted-entry warning.
        setDeletedHere(true);
        void remove(entry.id);
        props.onDone();
      }}
    />
  );
}

function CreateForm(props: EditDrawerProps) {
  const { t } = useLingui();
  useEditDrawerTitle(t`New entry`);
  const form = useOperationForm({
    entry: placeholderAlphaContract.create,
    operation: useCreateEntry(),
    draft: { name: "" },
    onDone: props.onDone,
  });
  return <Fields {...props} form={form} />;
}

function RenameForm({
  entry,
  deleted,
  onDelete,
  ...props
}: EditDrawerProps & {
  readonly entry: Entry;
  readonly deleted: boolean;
  readonly onDelete: () => void;
}) {
  const { t } = useLingui();
  useEditDrawerTitle(entry.name);
  const form = useOperationForm({
    entry: placeholderAlphaContract.rename,
    operation: useRenameEntry(),
    draft: { id: entry.id, name: entry.name },
    edit: { identity: { id: entry.id }, deleted },
    onDone: props.onDone,
  });
  return (
    <Fields
      {...props}
      form={form}
      actions={<Button onClick={onDelete} variant="subtle">{t`Delete`}</Button>}
    />
  );
}

function Fields({
  id,
  form,
  onCancel,
  actions,
}: {
  readonly id: string;
  readonly form: OperationForm<{ name: string | null }>;
  readonly onCancel: () => void;
  readonly actions?: React.ReactNode;
}) {
  const { t } = useLingui();
  return (
    <EditDrawerForm form={form} onCancel={onCancel} actions={actions}>
      <Text>{id}</Text>
      <TextField form={form} name="name" label={t`Name`} />
    </EditDrawerForm>
  );
}
