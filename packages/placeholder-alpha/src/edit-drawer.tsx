import { useLingui } from "@lingui/react/macro";
import { Button, Stack, Text } from "@mantine/core";
import { type EditDrawerProps, useEditDrawerTitle } from "@self-engine/shell";
import { clients, NEW_ENTRY_ID } from "./sample-data.ts";

export default function EditDrawer({ id, onClose }: EditDrawerProps) {
  const { t, i18n } = useLingui();
  const entry = clients.find((client) => client.id === id)?.entry;
  useEditDrawerTitle(id === NEW_ENTRY_ID ? t`New entry` : entry && i18n._(entry));
  return (
    <Stack>
      <Text>{id}</Text>
      <Button onClick={onClose}>{t`Close entry`}</Button>
    </Stack>
  );
}
