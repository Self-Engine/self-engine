import { useLingui } from "@lingui/react/macro";
import { Button, Group, Stack } from "@mantine/core";
import { ProjectsIcon } from "@self-engine/icons";
import { useWriteViewSearch } from "@self-engine/shell";
import { EmptyState } from "@self-engine/ui";
import { deleteWithUndo } from "./delete-with-undo.tsx";
import { nameOf, useEntries } from "./entry-store.ts";
import { NEW_ENTRY_ID, useClientFilter } from "./sample-data.ts";

export default function Entries() {
  const { t, i18n } = useLingui();
  const write = useWriteViewSearch();
  const client = useClientFilter();
  const entries = useEntries().filter(({ id }) => !client || client === id);
  if (entries.length === 0) {
    return (
      <EmptyState
        action={
          <Button onClick={() => write((search) => ({ ...search, edit: NEW_ENTRY_ID }))}>
            {t`New entry`}
          </Button>
        }
        description={t`Entries you create appear here.`}
        icon={ProjectsIcon}
        title={t`No entries here`}
      />
    );
  }
  return (
    <Stack>
      {entries.map((entry) => {
        const name = nameOf(entry, i18n);
        return (
          <Group key={entry.id} wrap="nowrap">
            <Button
              flex={1}
              onClick={() => write((search) => ({ ...search, edit: entry.id }))}
              variant="subtle"
            >
              {name}
            </Button>
            <Button
              aria-label={t`Delete ${name}`}
              onClick={() => deleteWithUndo(entry.id)}
              variant="default"
            >
              {t`Delete`}
            </Button>
          </Group>
        );
      })}
    </Stack>
  );
}
