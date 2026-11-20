import { useLingui } from "@lingui/react/macro";
import { Button, Group, Stack, TextInput } from "@mantine/core";
import type { IndicatorPanelProps } from "@self-engine/shell";

/**
 * The Indicator Panel of the Shell's test subject: one field. The Shell gives it its frame, its
 * focus and its ways out; the content only says when it is done.
 */
export default function Panel({ onCancel, onDone }: IndicatorPanelProps) {
  const { t } = useLingui();
  return (
    <Stack gap="sm">
      <TextInput label={t`Note`} />
      <Group gap="xs" justify="flex-end">
        <Button onClick={onCancel} variant="default">
          {t`Cancel`}
        </Button>
        <Button onClick={onDone}>{t({ message: "Done", context: "Finish the panel" })}</Button>
      </Group>
    </Stack>
  );
}
