import { useLingui } from "@lingui/react/macro";
import { Button, Group, Text } from "@mantine/core";
import type { ModuleIndicatorProps } from "@self-engine/shell";
import { useState } from "react";

/**
 * The Module Indicator of the Shell's test subject: a counter and a button in the full form, the
 * counter alone in the short form. A real module reads what it shows through its own hooks.
 */
export default function Indicator({ form }: ModuleIndicatorProps) {
  const { t } = useLingui();
  const [count, setCount] = useState(0);
  if (form === "short") return <Text size="sm">{count}</Text>;
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="sm" truncate>{t`Counted ${count}`}</Text>
      <Button onClick={() => setCount(count + 1)} size="compact-sm" variant="subtle">
        {t`Count up`}
      </Button>
    </Group>
  );
}
