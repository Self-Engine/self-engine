// Throwaway page with the switches that change the appearance of the real app. Everything to look
// at lives in the Component Catalog. #23 removes the page.

import { SegmentedControl, Stack, Switch, Title } from "@mantine/core";
import {
  ACCENT_IDS,
  BUILT_IN_THEMES,
  type ColorMode,
  DENSITIES,
  type Density,
  FONT_SCALES,
  type FontScale,
  FROM_THEME,
} from "@self-engine/theme";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { usePreviewAppearance } from "../preview-appearance.tsx";

export const Route = createFileRoute("/theme-preview")({ component: ThemePreviewPage });

const COLOR_MODE_OPTIONS: { label: string; value: ColorMode }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

const ACCENT_OPTIONS = [
  { label: "From Theme", value: FROM_THEME },
  ...ACCENT_IDS.map((id) => ({ label: id, value: id })),
];

const THEME_OPTIONS = Object.values(BUILT_IN_THEMES).map(({ id, name }) => ({
  label: name,
  value: id,
}));

const FONT_SCALE_OPTIONS = FONT_SCALES.map((step) => ({
  label: `${step} %`,
  value: String(step),
}));

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

function ThemePreviewPage() {
  const [appearance, changeAppearance] = usePreviewAppearance();
  return (
    <Stack>
      <Title order={1}>Theme preview</Title>
      <Section title="Color Mode">
        <SegmentedControl
          data={COLOR_MODE_OPTIONS}
          onChange={(value) => {
            changeAppearance({ colorMode: value as ColorMode });
          }}
          value={appearance.colorMode}
        />
      </Section>
      <Section title="Density and font scale">
        <SegmentedControl
          data={[...DENSITIES]}
          onChange={(value) => {
            changeAppearance({ density: value as Density });
          }}
          value={appearance.density}
        />
        <SegmentedControl
          data={FONT_SCALE_OPTIONS}
          onChange={(value) => {
            changeAppearance({ fontScale: Number(value) as FontScale });
          }}
          value={String(appearance.fontScale)}
        />
      </Section>
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
      <Section title="Background Tint">
        <Switch
          checked={appearance.backgroundTint}
          label="Background Tint"
          onChange={(event) => {
            changeAppearance({ backgroundTint: event.currentTarget.checked });
          }}
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
