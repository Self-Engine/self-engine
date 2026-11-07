// PROTOTYPE: docked assistant (D64, provisional). Pushes content aside, app stays usable.
import { ActionIcon, Group, Text, TextInput, ThemeIcon } from "@mantine/core";
import { IconSend, IconSparkles, IconX } from "@tabler/icons-react";
import classes from "./shell.module.css";

export function Assistant({ onClose }: { onClose: () => void }) {
  return (
    <aside className={classes.assistant}>
      <Group justify="space-between" className={classes.assistantHeader}>
        <Group gap={8}>
          <ThemeIcon variant="light" size="sm" radius="xl">
            <IconSparkles size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Assistent
          </Text>
        </Group>
        <ActionIcon variant="subtle" color="gray" onClick={onClose} title="Schließen (⌘J)">
          <IconX size={16} />
        </ActionIcon>
      </Group>
      <div className={classes.assistantBody}>
        <div className={classes.bubbleUser}>Wie viele Stunden habe ich diese Woche für Acme gearbeitet?</div>
        <div className={classes.bubbleBot}>
          Diese Woche sind es <b>45,5 h</b> für Acme GmbH: 42,5 h Website-Relaunch und 3,0 h
          Wartungsvertrag. Soll ich die nicht abgerechneten Einträge öffnen?
        </div>
      </div>
      <div className={classes.assistantInput}>
        <TextInput
          placeholder="Frag etwas oder gib einen Auftrag…"
          rightSection={
            <ActionIcon variant="filled" size="sm">
              <IconSend size={14} />
            </ActionIcon>
          }
        />
      </div>
    </aside>
  );
}
