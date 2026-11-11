// Everything of the settings area that loads when the settings are first opened: one chunk for all
// Views, because the search needs the controls of every View (D202).

import { useLingui } from "@lingui/react";
import { Divider, Group, Stack, Text } from "@mantine/core";
import type { SettingsStore } from "@self-engine/settings";
import { type ComponentType, Fragment, useId } from "react";
import type { SettingsRow } from "./row.ts";
import { type SettingsRowSources, settingsRows } from "./rows.tsx";
import type { SettingsViewId } from "./views.ts";

interface RowProps {
  readonly row: SettingsRow;
  readonly store: SettingsStore;
}

function Row({ row, store }: RowProps) {
  const { i18n } = useLingui();
  const titleId = useId();
  const Control = row.control;
  return (
    <Group gap="md" justify="space-between" py="md">
      <Stack flex="1 1 16rem" gap={2}>
        <Text fw={500} id={titleId}>
          {i18n._(row.title)}
        </Text>
        {row.description && (
          <Text c="dimmed" size="sm">
            {i18n._(row.description)}
          </Text>
        )}
      </Stack>
      <Control labelledBy={titleId} store={store} />
    </Group>
  );
}

/** The page of one View: its rows from the list, in order. */
export function viewPage(
  view: SettingsViewId,
  { store, ...sources }: SettingsRowSources & { readonly store: SettingsStore },
): ComponentType {
  const rows = settingsRows(sources).filter((row) => row.view === view);
  return function SettingsViewPage() {
    return (
      <Stack gap={0} maw="48rem">
        {rows.map((row, index) => (
          <Fragment key={row.id}>
            {index > 0 && <Divider />}
            <Row row={row} store={store} />
          </Fragment>
        ))}
      </Stack>
    );
  };
}
