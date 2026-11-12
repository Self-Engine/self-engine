import { useLingui } from "@lingui/react/macro";
import { Button, Group, Stack } from "@mantine/core";
import { ProjectsIcon } from "@self-engine/icons";
import { useWriteViewSearch } from "@self-engine/shell";
import { EmptyState } from "@self-engine/ui";
import { deleteWithUndo } from "./delete-with-undo.tsx";
import { type Entry, nameOf, useEntries } from "./entry-store.ts";
import { memo } from "react";
import { NEW_ENTRY_ID, useClientFilter } from "./sample-data.ts";

export default function Entries() {
  const { t } = useLingui();
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
      {entries.map((entry) => (
        <EntryRow entry={entry} key={entry.id} />
      ))}
    </Stack>
  );
}

/**
 * A row is its own component behind `memo` and receives its entry whole, so that one changed entry
 * draws one row (docs/development/performance.md, "One changed row redraws one row").
 */
const EntryRow = memo(function EntryRow({ entry }: { readonly entry: Entry }) {
  const { t, i18n } = useLingui();
  const write = useWriteViewSearch();
  const name = nameOf(entry, i18n);
  return (
    <Group wrap="nowrap">
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
});
