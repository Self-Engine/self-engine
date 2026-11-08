// The Module Color part of the throwaway /theme-preview page. #23 removes it.

import { Button, SimpleGrid, Text } from "@mantine/core";
import { COLOR_SETS } from "@self-engine/theme";
import type { CSSProperties } from "react";

const AREA: CSSProperties = {
  background: "var(--se-nav-surface)",
  border: "1px solid var(--se-border)",
  borderRadius: "var(--mantine-radius-md)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--mantine-spacing-xs)",
  padding: "var(--mantine-spacing-md)",
};

const MARK: CSSProperties = {
  alignItems: "center",
  background: "var(--se-module)",
  borderRadius: "var(--mantine-radius-sm)",
  color: "var(--se-module-on)",
  display: "flex",
  fontWeight: 700,
  height: "2rem",
  justifyContent: "center",
  width: "2rem",
};

const ENTRY: CSSProperties = {
  borderRadius: "var(--mantine-radius-sm)",
  padding: "var(--mantine-spacing-xs)",
};

/** Knows nothing of its color: the scope around it decides. */
function ModuleSample({ name }: { readonly name: string }) {
  return (
    <>
      <div aria-hidden style={MARK}>
        {name.charAt(0).toUpperCase()}
      </div>
      <Text fw={600} style={{ color: "var(--se-module-text)" }}>
        {name}
      </Text>
      <div style={{ ...ENTRY, background: "var(--se-module-soft)", color: "var(--se-module-text)" }}>
        Active entry
      </div>
      <div style={ENTRY}>Other entry</div>
      <Button>Accent action</Button>
    </>
  );
}

/** One area per Color Set: navigation takes the Module Color, the action takes the Accent. */
export function ModuleColorsPreview() {
  return (
    <SimpleGrid cols={4}>
      {Object.keys(COLOR_SETS).map((name) => (
        <div data-module-color={name} key={name} style={AREA}>
          <ModuleSample name={name} />
        </div>
      ))}
    </SimpleGrid>
  );
}
