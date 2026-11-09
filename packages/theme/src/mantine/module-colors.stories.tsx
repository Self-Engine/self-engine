import { Button, SimpleGrid, Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { expect, within } from "storybook/test";
import { COLOR_SETS, roleColor } from "../core/index.ts";
import { activeColorMode, SET_NAMES } from "./story-samples.tsx";

const AREA: CSSProperties = {
  background: roleColor("navSurface"),
  border: `1px solid ${roleColor("border")}`,
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
      <div
        data-testid="active-entry"
        style={{ ...ENTRY, background: "var(--se-module-soft)", color: "var(--se-module-text)" }}
      >
        Active entry
      </div>
      <div style={ENTRY}>Other entry</div>
      <Button>Accent action</Button>
    </>
  );
}

/** One area per Color Set: navigation takes the Module Color, the action takes the Accent. */
function ModuleColors() {
  return (
    <SimpleGrid cols={4}>
      {SET_NAMES.map((name) => (
        <div data-module-color={name} data-testid={name} key={name} style={AREA}>
          <ModuleSample name={name} />
        </div>
      ))}
    </SimpleGrid>
  );
}

const meta = {
  title: "Appearance/Module Colors",
  component: ModuleColors,
} satisfies Meta<typeof ModuleColors>;

export default meta;

export const Overview: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await Promise.all(
      SET_NAMES.map(async (name) => {
        const area = within(canvas.getByTestId(name));
        await expect(area.getByTestId("active-entry")).toHaveStyle({
          backgroundColor: COLOR_SETS[name][activeColorMode()].accentSoft,
        });
        await expect(area.getByRole("button", { name: "Accent action" })).toBeVisible();
      }),
    );
  },
};
