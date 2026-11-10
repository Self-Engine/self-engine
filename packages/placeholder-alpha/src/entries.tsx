import { useLingui } from "@lingui/react/macro";
import { Stack, Button } from "@mantine/core";
import { useWriteViewSearch } from "@self-engine/shell";
import { nameOf, useEntries } from "./entry-store.ts";
import { useClientFilter } from "./sample-data.ts";

export default function Entries() {
  const { i18n } = useLingui();
  const write = useWriteViewSearch();
  const client = useClientFilter();
  const entries = useEntries();
  return (
    <Stack>
      {entries
        .filter(({ id }) => !client || client === id)
        .map((entry) => (
          <Button
            variant="subtle"
            key={entry.id}
            onClick={() => write((search) => ({ ...search, edit: entry.id }))}
          >
            {nameOf(entry, i18n)}
          </Button>
        ))}
    </Stack>
  );
}
