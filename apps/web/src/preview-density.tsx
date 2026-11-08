// The Density and font scale part of the throwaway /theme-preview page. #23 removes it.

import { Button, Group, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import { DENSITIES, type Density, FONT_SCALES, type FontScale } from "@self-engine/theme";
import type { CSSProperties, ReactNode } from "react";
import { usePreviewAppearance } from "./preview-appearance.tsx";

const ROW: CSSProperties = {
  alignItems: "center",
  background: "var(--se-surface)",
  borderBottom: "1px solid var(--se-border)",
  display: "flex",
  gap: "var(--se-gap)",
  minHeight: "var(--se-row-height)",
  paddingInline: "var(--se-padding)",
};

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div style={ROW}>
      <Text style={{ flex: 1 }}>{label}</Text>
      {children}
    </div>
  );
}

export function DensityPreview() {
  const [appearance, changeAppearance] = usePreviewAppearance();
  return (
    <Stack gap="xs">
      <SegmentedControl
        data={[...DENSITIES]}
        onChange={(value) => {
          changeAppearance({ density: value as Density });
        }}
        value={appearance.density}
      />
      <SegmentedControl
        data={FONT_SCALES.map((step) => ({ label: `${step} %`, value: String(step) }))}
        onChange={(value) => {
          changeAppearance({ fontScale: Number(value) as FontScale });
        }}
        value={String(appearance.fontScale)}
      />
      <div>
        <Row label="Default sizes, must fit the row">
          <Group gap="var(--se-gap)">
            <TextInput aria-label="Default input" placeholder="Default" />
            <Button>Default</Button>
          </Group>
        </Row>
        <Row label="Explicit size md, must stay as it is">
          <Group gap="var(--se-gap)">
            <TextInput aria-label="Explicit input" placeholder="md" size="md" />
            <Button size="md">md</Button>
          </Group>
        </Row>
      </div>
    </Stack>
  );
}
