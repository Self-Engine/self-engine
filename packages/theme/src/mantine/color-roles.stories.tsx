import { Group, Paper, SimpleGrid, Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { type FinalColors, roleVariable } from "../core/index.ts";
import { useFinalColors } from "./index.tsx";

type Role = keyof FinalColors;

function ColorRoles() {
  const colors = useFinalColors();
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
      {(Object.keys(colors) as Role[]).map((role) => (
        <Paper key={role} p="xs" withBorder>
          <Group wrap="nowrap">
            <div
              data-testid={role}
              style={{
                background: `var(${roleVariable(role)})`,
                border: "1px solid var(--se-border)",
                borderRadius: 4,
                height: 32,
                width: 32,
              }}
            />
            <div>
              <Text size="sm">{role}</Text>
              <Text c="dimmed" size="xs">
                {colors[role]}
              </Text>
            </div>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

const meta = {
  title: "Tokens/Color Roles",
  component: ColorRoles,
} satisfies Meta<typeof ColorRoles>;

export default meta;

export const Overview: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("surfaceRaised")).toBeVisible();
    const swatch = canvas.getByTestId("text");
    await expect(getComputedStyle(swatch).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  },
};
