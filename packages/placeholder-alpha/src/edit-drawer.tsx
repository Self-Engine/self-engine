import { useLingui } from "@lingui/react/macro";
import { Button, Stack, Text } from "@mantine/core";
import type { EditDrawerProps } from "@self-engine/shell";

export default function EditDrawer({ id, onClose }: EditDrawerProps) {
  const { t } = useLingui();
  return (
    <Stack>
      <Text>{id}</Text>
      <Button onClick={onClose}>{t`Close entry`}</Button>
    </Stack>
  );
}
