import { useLingui } from "@lingui/react/macro";
import { Stack, Button } from "@mantine/core";
import { useWriteViewSearch } from "@self-engine/shell";
import { clients, useClientFilter } from "./sample-data.ts";

export default function Entries() {
  const { i18n } = useLingui();
  const write = useWriteViewSearch();
  const client = useClientFilter();
  return (
    <Stack>
      {clients
        .filter(({ id }) => !client || client === id)
        .map(({ id, entry }) => (
          <Button
            variant="subtle"
            key={id}
            onClick={() => write((search) => ({ ...search, edit: id }))}
          >
            {i18n._(entry)}
          </Button>
        ))}
    </Stack>
  );
}
