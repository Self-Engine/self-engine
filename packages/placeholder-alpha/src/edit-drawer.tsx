import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { type EditDrawerProps, useEditDrawerTitle, useUnsavedChanges } from "@self-engine/shell";
import { ErrorState, QueryStateBlock } from "@self-engine/ui";
import { useState } from "react";
import { useDeleteWithUndo } from "./delete-with-undo.tsx";
import { NEW_ENTRY_ID } from "./entry-address.ts";
import { ALL_ENTRIES, type Entry, useCreateEntry, useEntries, useRenameEntry } from "./port.ts";

export default function EditDrawer({ id, onCancel, onDone }: EditDrawerProps) {
  const { t } = useLingui();
  const list = useEntries(ALL_ENTRIES);
  const remove = useDeleteWithUndo();
  // Deleting closes the drawer, and the form keeps its own copy of the entry while the drawer
  // slides out, so it shows neither an empty form nor "not found" (D252; removed in #132).
  const [deletedHere, setDeletedHere] = useState<Entry>();
  if (id === NEW_ENTRY_ID) {
    return <EntryForm entry={undefined} id={id} onCancel={onCancel} onDone={onDone} />;
  }
  return (
    <QueryStateBlock state={list}>
      {(entries) => {
        const entry = entries.find((candidate) => candidate.id === id) ?? deletedHere;
        if (entry === undefined) {
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
        const deleteHere = () => {
          setDeletedHere(entry);
          void remove(entry.id);
          onDone();
        };
        return (
          <EntryForm
            entry={entry}
            id={id}
            onCancel={onCancel}
            onDelete={deleteHere}
            onDone={onDone}
          />
        );
      }}
    </QueryStateBlock>
  );
}

interface EntryFormProps extends EditDrawerProps {
  /** Left out for an entry that does not exist yet. */
  readonly entry: Entry | undefined;
  readonly onDelete?: () => void;
}

/**
 * Saving creates or renames through an Operation, and the name cannot change until it answers. A
 * taken name is shown at the field and the drawer stays open; "not found" closes it after the
 * building block's notice; an unexpected error keeps it open with the building block's notice
 * (D251).
 */
function EntryForm({ id, entry, onCancel, onDelete, onDone }: EntryFormProps) {
  const { t, i18n } = useLingui();
  const create = useCreateEntry();
  const rename = useRenameEntry();
  useEditDrawerTitle(entry === undefined ? t`New entry` : entry.name);
  const [startedFrom] = useState(entry?.name ?? "");
  const [draft, setDraft] = useState(startedFrom);
  const [conflict, setConflict] = useState<MessageDescriptor>();
  useUnsavedChanges(() => draft !== startedFrom);
  const running = create.running || rename.running;
  const save = async () => {
    const result =
      entry === undefined
        ? await create.run({ name: draft })
        : await rename.run({ id: entry.id, name: draft });
    if (result.status === "success" || result.status === "notFound") onDone();
    else if (result.status === "conflict") setConflict(result.text);
  };
  return (
    <Stack flex={1}>
      <Text>{id}</Text>
      <TextInput
        error={conflict && i18n._(conflict)}
        label={t`Name`}
        // What is typed while the save runs would be lost when the drawer closes.
        readOnly={running}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          setConflict(undefined);
        }}
        value={draft}
      />
      <Group justify="flex-end" mt="auto">
        {onDelete && (
          <Button me="auto" onClick={onDelete} variant="subtle">
            {t`Delete`}
          </Button>
        )}
        <Button onClick={onCancel} variant="default">{t`Cancel`}</Button>
        <Button disabled={draft === ""} loading={running} onClick={() => void save()}>
          {t`Save`}
        </Button>
      </Group>
    </Stack>
  );
}
