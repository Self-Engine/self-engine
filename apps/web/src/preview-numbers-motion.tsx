// Samples for the throwaway /theme-preview page. #23 removes them with the page.

import { Group, Stack, Text } from "@mantine/core";
import type { CSSProperties } from "react";

const NUMBERS = ["1,111.11", "7,420.00", "8,888.88", "10:11:11", "20:48:09"];

function NumberColumn({ label, style }: { readonly label: string; readonly style: CSSProperties }) {
  return (
    <Stack gap={0} style={{ textAlign: "right" }}>
      <Text c="dimmed">{label}</Text>
      {NUMBERS.map((value) => (
        <Text key={value} style={style}>
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

export function NumbersSample() {
  return (
    <Group gap="xl">
      <NumberColumn label="Tabular" style={{ fontVariantNumeric: "var(--se-tabular-nums)" }} />
      <NumberColumn label="Default" style={{ fontVariantNumeric: "normal" }} />
    </Group>
  );
}

/** These fade on their own, so a Theme switch that animates would show here. */
export function MotionSample() {
  return (
    <Group grow>
      <div style={fading("--se-motion-fast")}>--se-motion-fast</div>
      <div style={fading("--se-motion-base")}>--se-motion-base</div>
    </Group>
  );
}
