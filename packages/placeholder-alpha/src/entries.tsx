import { useLingui } from "@lingui/react/macro";
import { Stack, Text } from "@mantine/core";
import { clients, useClientFilter } from "./sample-data.ts";

export default function Entries() {
  const { i18n } = useLingui();
  const client = useClientFilter();
  return (
    <Stack>
      {clients
        .filter(({ id }) => !client || client === id)
        .map(({ id, entry }) => (
          <Text key={id}>{i18n._(entry)}</Text>
        ))}
    </Stack>
  );
}
