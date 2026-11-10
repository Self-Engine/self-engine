import { useLingui } from "@lingui/react/macro";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { type EditDrawerProps, useEditDrawerTitle, useUnsavedChanges } from "@self-engine/shell";
import { ErrorState } from "@self-engine/ui";
import { useState } from "react";
import { deleteWithUndo } from "./delete-with-undo.tsx";
import { type Entry, nameOf, saveEntry, useEntries } from "./entry-store.ts";
import { FLAKY_ENTRY_ID, NEW_ENTRY_ID } from "./sample-data.ts";

export default function EditDrawer({ id, onCancel, onDone }: EditDrawerProps) {
  const { t } = useLingui();
  const stored = useEntries().find((candidate) => candidate.id === id);
  // Deleting closes the drawer, and the form stays on the entry while the drawer slides out.
  const [deletedHere, setDeletedHere] = useState<Entry>();
  const entry = stored ?? deletedHere;
  const [loadFailed, setLoadFailed] = useState(id === FLAKY_ENTRY_ID);
  if (loadFailed) {
    return (
      <ErrorState onRetry={() => setLoadFailed(false)} title={t`This entry could not be loaded.`} />
    );
  }
  if (!entry && id !== NEW_ENTRY_ID) {
    return (
      <ErrorState
        action={
          <Button onClick={onDone} variant="default">
            {t({ message: "Close", context: "Close the drawer" })}
          </Button>
        }
        title={t`Entry not found`}
      />
    );
  }
  const remove = () => {
    setDeletedHere(entry);
    deleteWithUndo(id);
    onDone();
  };
  return <EntryForm entry={entry} id={id} onCancel={onCancel} onDelete={remove} onDone={onDone} />;
}

interface EntryFormProps extends EditDrawerProps {
  /** Left out for an entry that does not exist yet. */
  readonly entry: Entry | undefined;
  readonly onDelete: () => void;
}

function EntryForm({ id, entry, onCancel, onDelete, onDone }: EntryFormProps) {
  const { t, i18n } = useLingui();
  const savedName = entry && nameOf(entry, i18n);
  useEditDrawerTitle(id === NEW_ENTRY_ID ? t`New entry` : savedName);
  // Kept from the start, so that a change of language does not count as an edit.
  const [startedFrom] = useState(savedName ?? "");
  const [draft, setDraft] = useState(startedFrom);
  useUnsavedChanges(() => draft !== startedFrom);
  const save = () => {
    saveEntry(id, draft);
    onDone();
  };
  return (
    <Stack flex={1}>
      <Text>{id}</Text>
      <TextInput
        label={t`Name`}
        onChange={(event) => setDraft(event.currentTarget.value)}
        value={draft}
      />
      <Group justify="flex-end" mt="auto">
        {entry && (
          <Button me="auto" onClick={onDelete} variant="subtle">
            {t`Delete`}
          </Button>
        )}
        <Button onClick={onCancel} variant="default">{t`Cancel`}</Button>
        <Button onClick={save}>{t`Save`}</Button>
      </Group>
    </Stack>
  );
}
