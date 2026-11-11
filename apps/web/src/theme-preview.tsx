// Throwaway page with the Theme and Accent switches, which have no Settings Row yet. #160 replaces
// it with the rows and removes the page.

import { SegmentedControl, Stack, Title } from "@mantine/core";
import { appearanceChanges } from "@self-engine/settings-area/settings";
import { ACCENT_IDS, type Appearance, BUILT_IN_THEMES, FROM_THEME } from "@self-engine/theme";
import type { ReactNode } from "react";
import { useAppearance } from "./appearance.tsx";
import { settingsStore } from "./settings-store.ts";

const ACCENT_OPTIONS = [
  { label: "From Theme", value: FROM_THEME },
  ...ACCENT_IDS.map((id) => ({ label: id, value: id })),
];

const THEME_OPTIONS = Object.values(BUILT_IN_THEMES).map(({ id, name }) => ({
  label: name,
  value: id,
}));

function changeAppearance(changed: Partial<Appearance>): void {
  settingsStore.writeAll(appearanceChanges(changed));
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Title order={2} size="h4">
        {title}
      </Title>
      {children}
    </Stack>
  );
}

export default function ThemePreviewPage() {
  const appearance = useAppearance();
  return (
    <Stack>
      <Section title="Light Theme">
        <SegmentedControl
          data={THEME_OPTIONS}
          onChange={(lightTheme) => {
            changeAppearance({ lightTheme });
          }}
          value={appearance.lightTheme}
        />
      </Section>
      <Section title="Dark Theme">
        <SegmentedControl
          data={THEME_OPTIONS}
          onChange={(darkTheme) => {
            changeAppearance({ darkTheme });
          }}
          value={appearance.darkTheme}
        />
      </Section>
      <Section title="Accent">
        <SegmentedControl
          data={ACCENT_OPTIONS}
          onChange={(value) => {
            changeAppearance({ accent: value });
          }}
          value={appearance.accent}
        />
      </Section>
    </Stack>
  );
}
