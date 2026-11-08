import { Group, Stack, Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { expect } from "storybook/test";

const NUMBERS = ["1,111.11", "7,420.00", "8,888.88", "10:11:11", "20:48:09"];

function NumberColumn({ label, style }: { readonly label: string; readonly style: CSSProperties }) {
  return (
    <Stack data-testid={label} gap={0} style={{ textAlign: "right", ...style }}>
      <Text c="dimmed">{label}</Text>
      {NUMBERS.map((value) => (
        <Text inherit key={value}>
          {value}
        </Text>
      ))}
    </Stack>
  );
}

function fading(token: string): CSSProperties {
  return {
    background: "var(--se-surface)",
    color: "var(--se-accent-text)",
    border: "1px solid var(--se-border)",
    padding: "var(--mantine-spacing-md)",
    transition: `background-color var(${token}), color var(${token}), border-color var(${token})`,
  };
}

function Numbers() {
  return (
    <Group gap="xl">
      <NumberColumn label="Tabular" style={{ fontVariantNumeric: "var(--se-tabular-nums)" }} />
      <NumberColumn label="Default" style={{ fontVariantNumeric: "normal" }} />
    </Group>
  );
}

function Motion() {
  return (
    <Group grow>
      <div style={fading("--se-motion-fast")}>--se-motion-fast</div>
      <div style={fading("--se-motion-base")}>--se-motion-base</div>
    </Group>
  );
}

const meta = {
  title: "Tokens/Numbers and Motion",
} satisfies Meta;

export default meta;

export const TabularNumbers: StoryObj<typeof meta> = {
  render: () => <Numbers />,
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("Tabular")).toHaveStyle({ fontVariantNumeric: "tabular-nums" });
    await expect(canvas.getByTestId("Default")).toHaveStyle({ fontVariantNumeric: "normal" });
  },
};

/** These fade on their own, so a Theme switch that animates would show here. */
export const FadingColors: StoryObj<typeof meta> = {
  render: () => <Motion />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("--se-motion-fast")).toBeVisible();
    await expect(canvas.getByText("--se-motion-base")).toBeVisible();
  },
};
