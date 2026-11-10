import { useLingui } from "@lingui/react/macro";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import {
  type EditDrawerProps,
  useEditDrawerTitle,
  useUnsavedChanges,
} from "@self-engine/shell";
import { useState } from "react";
import { nameOf, saveEntry, useEntries } from "./entry-store.ts";
import { NEW_ENTRY_ID } from "./sample-data.ts";

export default function EditDrawer({ id, onCancel, onDone }: EditDrawerProps) {
  const { t, i18n } = useLingui();
  const entry = useEntries().find((candidate) => candidate.id === id);
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
        <Button onClick={onCancel} variant="default">{t`Cancel`}</Button>
        <Button onClick={save}>{t`Save`}</Button>
      </Group>
    </Stack>
  );
}
