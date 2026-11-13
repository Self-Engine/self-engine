import { useLingui } from "@lingui/react/macro";
import { Button, Group, Stack } from "@mantine/core";
import { ProjectsIcon } from "@self-engine/icons";
import { useWriteViewSearch } from "@self-engine/shell";
import { EmptyState, QueryStateBlock } from "@self-engine/ui";
import { memo } from "react";
import { useDeleteWithUndo } from "./delete-with-undo.tsx";
import { NEW_ENTRY_ID } from "./entry-address.ts";
import { ALL_ENTRIES, type Entry, useEntries } from "./port.ts";

/**
 * The list reads through the Query hook: a Table Change of its table reloads it, and the previous
 * rows stay on screen until the new ones arrive (D250, D257).
 */
export default function Entries() {
  return (
    <QueryStateBlock state={useEntries(ALL_ENTRIES)}>
      {(entries) => <EntryList entries={entries} />}
    </QueryStateBlock>
  );
}

function EntryList({ entries }: { readonly entries: readonly Entry[] }) {
  const { t } = useLingui();
  const write = useWriteViewSearch();
  const remove = useDeleteWithUndo();
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
        <EntryRow entry={entry} key={entry.id} onDelete={remove} />
      ))}
    </Stack>
  );
}

/**
 * A row is its own component behind `memo` and receives its entry whole, so that one changed entry
 * draws one row (docs/development/performance.md, "One changed row redraws one row"). An unchanged
 * entry keeps its object across a reload, and `onDelete` stays the same function.
 */
const EntryRow = memo(function EntryRow({
  entry,
  onDelete,
}: {
  readonly entry: Entry;
  readonly onDelete: (id: Entry["id"]) => Promise<void>;
}) {
  const { t } = useLingui();
  const write = useWriteViewSearch();
  const { name } = entry;
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
        onClick={() => void onDelete(entry.id)}
        variant="default"
      >
        {t`Delete`}
      </Button>
    </Group>
  );
});
