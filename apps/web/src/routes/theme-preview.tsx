// Throwaway page to judge the Theme before Storybook exists. #23 removes it.

import { Group, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import type { ColorMode } from "@self-engine/theme";
import { createFileRoute } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { usePreviewAppearance } from "../preview-appearance.tsx";
import { PreviewMantineComponents } from "../preview-mantine-components.tsx";

export const Route = createFileRoute("/theme-preview")({ component: ThemePreviewPage });

const COLOR_MODE_OPTIONS: { label: string; value: ColorMode }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

const SURFACES = ["chrome", "nav-surface", "canvas", "surface", "surface-raised"] as const;
const STATUSES = ["error", "warning", "success"] as const;

function color(role: string): string {
  return `var(--se-${role})`;
}

function box(background: string, extra: CSSProperties = {}): CSSProperties {
  return {
    background,
    padding: "var(--mantine-spacing-md)",
    borderRadius: "var(--mantine-radius-md)",
    ...extra,
  };
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

function SurfaceSample({ role }: { readonly role: (typeof SURFACES)[number] }) {
  return (
    <div style={box(color(role), { border: `1px solid ${color("border")}` })}>
      <Text fw={600}>{role}</Text>
      <Text style={{ color: color("text") }}>text</Text>
      <Text style={{ color: color("text-muted") }}>textMuted</Text>
      {role !== "chrome" && (
        <div style={box(color("hover"), { marginTop: "var(--mantine-spacing-xs)" })}>
          <Text style={{ color: color("text") }}>text on hover</Text>
          <Text style={{ color: color("text-muted") }}>textMuted on hover</Text>
        </div>
      )}
    </div>
  );
}

function StatusSample({ status }: { readonly status: (typeof STATUSES)[number] }) {
  return (
    <Group grow>
      <div style={box(color(status), { color: color(`on-${status}`) })}>{status} fill</div>
      <div style={box(color(`${status}-soft`), { color: color(`${status}-text`) })}>
        {status} soft
      </div>
      <div style={box(color("surface"), { color: color(`${status}-text`) })}>{status} text</div>
    </Group>
  );
}

function ThemePreviewPage() {
  const [appearance, setAppearance] = usePreviewAppearance();
  return (
    <Stack>
      <Title order={1}>Theme preview</Title>
      <Section title="Color Mode">
        <SegmentedControl
          data={COLOR_MODE_OPTIONS}
          onChange={(value) => {
            setAppearance({ ...appearance, colorMode: value as ColorMode });
          }}
          value={appearance.colorMode}
        />
      </Section>
      <Section title="Surfaces, text and hover">
        <Group align="stretch" grow>
          {SURFACES.map((role) => (
            <SurfaceSample key={role} role={role} />
          ))}
        </Group>
      </Section>
      <Section title="Lines">
        <div
          style={{
            borderTop: `1px solid ${color("border")}`,
            paddingTop: "var(--mantine-spacing-xs)",
          }}
        >
          border (decorative)
        </div>
        <div style={box(color("surface"), { border: `1px solid ${color("border-control")}` })}>
          borderControl (input outline)
        </div>
      </Section>
      <Section title="Accent">
        <Group grow>
          <div style={box(color("accent"), { color: color("on-accent") })}>accent fill</div>
          <div style={box(color("accent-soft"), { color: color("accent-text") })}>accent soft</div>
        </Group>
      </Section>
      <Section title="Status">
        {STATUSES.map((status) => (
          <StatusSample key={status} status={status} />
        ))}
      </Section>
      <Section title="Mantine components">
        <PreviewMantineComponents />
      </Section>
    </Stack>
  );
}
