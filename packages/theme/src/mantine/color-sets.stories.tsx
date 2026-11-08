import { Paper, SimpleGrid, Stack, Text, useComputedColorScheme } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { COLOR_SETS, type ColorSetRole } from "../core/index.ts";
import { SET_NAMES, Swatch } from "./story-samples.tsx";

function ColorSets() {
  const colorMode = useComputedColorScheme("light");
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
      {SET_NAMES.map((name) => (
        <Paper data-testid={name} key={name} p="xs" withBorder>
          <Stack gap="xs">
            <Text fw={600}>{name}</Text>
            {(Object.keys(COLOR_SETS[name][colorMode]) as ColorSetRole[]).map((role) => (
              <Swatch
                color={COLOR_SETS[name][colorMode][role]}
                key={role}
                label={role}
                value={COLOR_SETS[name][colorMode][role]}
              />
            ))}
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

const meta = {
  title: "Appearance/Color Sets",
  component: ColorSets,
} satisfies Meta<typeof ColorSets>;

export default meta;

function expectValuesOf(canvasElement: HTMLElement, mode: "light" | "dark") {
  return Promise.all(
    SET_NAMES.map(async (name) => {
      const set = within(within(canvasElement).getByTestId(name));
      await expect(set.getByText(COLOR_SETS[name][mode].accentSoft)).toBeVisible();
      await expect(set.getByText(COLOR_SETS[name][mode].accentText)).toBeVisible();
    }),
  );
}

export const Light: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    await expectValuesOf(canvasElement, "light");
  },
};

/** The values change with the Color Mode, so this statement needs its own appearance. */
export const Dark: StoryObj<typeof meta> = {
  globals: { colorMode: "dark" },
  play: async ({ canvasElement }) => {
    await expectValuesOf(canvasElement, "dark");
  },
};
