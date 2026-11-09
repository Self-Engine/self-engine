import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties, ReactNode } from "react";
import { expect } from "storybook/test";
import { roleColor } from "../core/index.ts";

/** Mantine's height of size `xs` at the 100 % font scale, which `Compact` fixes. */
const COMPACT_CONTROL_HEIGHT = 30;

function Controls() {
  return (
    <Stack align="flex-start">
      <Button>Save</Button>
      <TextInput aria-label="Name" placeholder="Name" />
    </Stack>
  );
}

const ROW: CSSProperties = {
  alignItems: "center",
  background: roleColor("surface"),
  borderBottom: `1px solid ${roleColor("border")}`,
  display: "flex",
  gap: "var(--se-gap)",
  minHeight: "var(--se-row-height)",
  paddingInline: "var(--se-padding)",
};

function Row({
  children,
  label,
  testId,
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly testId?: string;
}) {
  return (
    <div data-testid={testId} style={ROW}>
      <Text style={{ flex: 1 }}>{label}</Text>
      {children}
    </div>
  );
}

function Rows() {
  return (
    <div>
      <Row label="Default sizes, must fit the row" testId="default-row">
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
  );
}

const meta = {
  title: "Appearance/Density",
  component: Controls,
} satisfies Meta<typeof Controls>;

export default meta;

export const ComfortableRows: StoryObj<typeof meta> = {
  render: () => <Rows />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Default" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "md" })).toBeVisible();
  },
};

/** A height in pixels holds at one font scale only, so this statement fixes that too. */
export const Compact: StoryObj<typeof meta> = {
  globals: { density: "compact", fontScale: "100" },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Save" });
    await expect(button.getBoundingClientRect().height).toBe(COMPACT_CONTROL_HEIGHT);
    const input = canvas.getByRole("textbox", { name: "Name" });
    await expect(input.getBoundingClientRect().height).toBe(COMPACT_CONTROL_HEIGHT);
  },
};

/** A comfortable row is 44 px at 100 % and grows with the font scale, like Mantine's sizes do. */
export const AtTheLargestFontScale: StoryObj<typeof meta> = {
  globals: { density: "comfortable", fontScale: "112.5" },
  render: () => <div data-testid="row" style={{ height: "var(--se-row-height)" }} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("row").getBoundingClientRect().height).toBe(49.5);
  },
};

export const CompactRows: StoryObj<typeof meta> = {
  globals: { density: "compact" },
  render: () => <Rows />,
  play: async ({ canvas }) => {
    const height = (name: string) =>
      canvas.getByRole("button", { name }).getBoundingClientRect().height;
    const row = canvas.getByTestId("default-row").getBoundingClientRect().height;
    await expect(height("Default")).toBeLessThanOrEqual(row);
    await expect(height("md")).toBeGreaterThan(height("Default"));
  },
};
