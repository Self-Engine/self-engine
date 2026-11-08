// Throwaway page to judge the Theme before Storybook exists. #23 removes it.

import { Button, Group, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { ACCENT_IDS, BUILT_IN_THEMES, type ColorMode, FROM_THEME } from "@self-engine/theme";
import { createFileRoute } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { usePreviewAppearance } from "../preview-appearance.tsx";
import { BackgroundTintPreview } from "../preview-background-tint.tsx";
import { BadgesPreview } from "../preview-badges.tsx";
import { DensityPreview } from "../preview-density.tsx";
import { PreviewMantineComponents } from "../preview-mantine-components.tsx";
import { ModuleColorsPreview } from "../preview-module-colors.tsx";
import { MotionSample, NumbersSample } from "../preview-numbers-motion.tsx";
import { roleColor as color } from "../preview-role-color.ts";

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
const BUTTON_VARIANTS = ["filled", "light", "outline", "subtle"] as const;

const THEME_OPTIONS = Object.values(BUILT_IN_THEMES).map(({ id, name }) => ({
  label: name,
  value: id,
}));

const SURFACES = ["chrome", "navSurface", "canvas", "surface", "surfaceRaised"] as const;
const STATUS_FILL_TEXT = { error: "onError", warning: "onWarning", success: "onSuccess" } as const;
type Status = keyof typeof STATUS_FILL_TEXT;
const STATUSES = Object.keys(STATUS_FILL_TEXT) as Status[];

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
      <Text style={{ color: color("textMuted") }}>textMuted</Text>
      {role !== "chrome" && (
        <div style={box(color("hover"), { marginTop: "var(--mantine-spacing-xs)" })}>
          <Text style={{ color: color("text") }}>text on hover</Text>
          <Text style={{ color: color("textMuted") }}>textMuted on hover</Text>
        </div>
      )}
    </div>
  );
}

function StatusSample({ status }: { readonly status: Status }) {
  return (
    <Group grow>
      <div style={box(color(status), { color: color(STATUS_FILL_TEXT[status]) })}>
        {status} fill
      </div>
      <div style={box(color(`${status}Soft`), { color: color(`${status}Text`) })}>
        {status} soft
      </div>
      <div style={box(color("surface"), { color: color(`${status}Text`) })}>{status} text</div>
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
      <Section title="Density and font scale">
        <DensityPreview />
      </Section>
      <Section title="Light Theme">
        <SegmentedControl
          data={THEME_OPTIONS}
          onChange={(lightTheme) => {
            setAppearance({ ...appearance, lightTheme });
          }}
          value={appearance.lightTheme}
        />
      </Section>
      <Section title="Dark Theme">
        <SegmentedControl
          data={THEME_OPTIONS}
          onChange={(darkTheme) => {
            setAppearance({ ...appearance, darkTheme });
          }}
          value={appearance.darkTheme}
        />
      </Section>
      <Section title="Numbers">
        <NumbersSample />
      </Section>
      <Section title="Motion: a Theme or Color Mode switch must not fade these">
        <MotionSample />
      </Section>
      <Section title="Background Tint">
        <BackgroundTintPreview />
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
        <div style={box(color("surface"), { border: `1px solid ${color("borderControl")}` })}>
          borderControl (input outline)
        </div>
      </Section>
      <Section title="Accent">
        <SegmentedControl
          data={ACCENT_OPTIONS}
          onChange={(value) => {
            setAppearance({ ...appearance, accent: value });
          }}
          value={appearance.accent}
        />
        <Group>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </Group>
        <Group>
          {BUTTON_VARIANTS.map((variant) => (
            <Button color="teal" key={variant} variant={variant}>
              teal {variant}
            </Button>
          ))}
        </Group>
        <Group grow>
          <div style={box(color("accent"), { color: color("onAccent") })}>accent fill</div>
          <div style={box(color("accentSoft"), { color: color("accentText") })}>accent soft</div>
        </Group>
      </Section>
      <Section title="Badges">
        <BadgesPreview />
      </Section>
      <Section title="Status">
        {STATUSES.map((status) => (
          <StatusSample key={status} status={status} />
        ))}
      </Section>
      <Section title="Module Colors: navigation uses the Module Color, actions use the Accent">
        <ModuleColorsPreview />
      </Section>
      <Section title="Mantine components">
        <PreviewMantineComponents />
      </Section>
    </Stack>
  );
}
