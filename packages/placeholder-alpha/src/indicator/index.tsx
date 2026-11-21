import { useLingui } from "@lingui/react/macro";
import { Button, Group } from "@mantine/core";
import type { ModuleIndicatorWithPanelProps } from "@self-engine/shell";
import { useState } from "react";

/**
 * The Module Indicator of the Shell's test subject: a counter and a button in the full form, the
 * counter alone in the short form. The counter opens the module's Indicator Panel and tells a
 * screen reader whether it is open. A real module
 * reads what it shows through its own hooks.
 */
export default function Indicator({ form, togglePanel, panelOpen }: ModuleIndicatorWithPanelProps) {
  const { t } = useLingui();
  const [count, setCount] = useState(0);
  const counter = (
    <Button
      aria-expanded={panelOpen}
      aria-haspopup="dialog"
      onClick={togglePanel}
      size="compact-sm"
      variant="subtle"
    >
      {form === "short" ? count : t`Counted ${count}`}
    </Button>
  );
  if (form === "short") return counter;
  return (
    <Group gap={0} wrap="nowrap">
      {counter}
      <Button onClick={() => setCount(count + 1)} size="compact-sm" variant="subtle">
        {t`Count up`}
      </Button>
    </Group>
  );
}
