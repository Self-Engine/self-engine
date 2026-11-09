import { Group, Stack, Table, Text, useMantineTheme } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { DENSITIES, DENSITY_VARIABLES, roleColor } from "../core/index.ts";
import { isStrictlyIncreasing } from "./story-samples.tsx";

/** Each Density's variables share their names, so the first Density lists them for all. */
const DENSITY_VARIABLE_NAMES = Object.keys(DENSITY_VARIABLES[DENSITIES[0]]) as Array<
  keyof (typeof DENSITY_VARIABLES)[(typeof DENSITIES)[number]]
>;

function Spacing() {
  const { spacing } = useMantineTheme();
  return (
    <Stack>
      <Text c="dimmed">
        Mantine's own spacing scale, which the app uses as it is: the theme engine sets no spacing.
      </Text>
      <Stack gap="xs">
        {Object.entries(spacing).map(([step, value]) => (
          <Group key={step}>
            <div
              data-testid={step}
              style={{ background: roleColor("accent"), height: "1rem", width: value }}
            />
            <Text size="sm">
              {step}: {value}
            </Text>
          </Group>
        ))}
      </Stack>
      <Text c="dimmed">The Density variables, which the theme engine does own.</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Variable</Table.Th>
            {DENSITIES.map((density) => (
              <Table.Th key={density}>{density}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {DENSITY_VARIABLE_NAMES.map((variable) => (
            <Table.Tr key={variable}>
              <Table.Td>{variable}</Table.Td>
              {DENSITIES.map((density) => (
                <Table.Td key={density}>{DENSITY_VARIABLES[density][variable]}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

const meta = {
  title: "Appearance/Spacing",
  component: Spacing,
} satisfies Meta<typeof Spacing>;

export default meta;

export const Overview: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    const widths = ["xs", "sm", "md", "lg", "xl"].map(
      (step) => canvas.getByTestId(step).getBoundingClientRect().width,
    );
    await expect(isStrictlyIncreasing(widths)).toBe(true);
    await expect(canvas.getByText("--se-row-height")).toBeVisible();
  },
};
