import { Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { COLOR_SETS, roleColor } from "@self-engine/theme";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import * as icons from "./index.ts";

const SIZES = ["xs", "sm", "md", "lg"] as const;
const BUTTON_VARIANTS = ["filled", "light", "outline", "subtle"] as const;
const TEXT_ROLES = ["text", "textMuted"] as const;

/** Reads the package's exports, so a new icon shows up here by itself. */
const CATALOG = Object.entries(icons);

const meta = {
  title: "Icons/Catalog",
} satisfies Meta;

export default meta;

export const Catalog: StoryObj<typeof meta> = {
  render: () => (
    <SimpleGrid cols={4}>
      {CATALOG.map(([name, Icon]) => (
        <Group gap="xs" key={name}>
          <Icon />
          <Text>{name}</Text>
        </Group>
      ))}
    </SimpleGrid>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll("svg")).toHaveLength(CATALOG.length);
    await expect(canvas.getByText("TimeIcon")).toBeVisible();
  },
};

/** Each step beside text of the same step, to judge the proportion at every font scale. */
export const Sizes: StoryObj<typeof meta> = {
  render: () => (
    <Group gap="xl">
      {SIZES.map((size) => (
        <Group gap="xs" key={size}>
          <icons.TimeIcon size={size} />
          <Text size={size}>{size} text</Text>
        </Group>
      ))}
    </Group>
  ),
  play: async ({ canvasElement }) => {
    const widths = [...canvasElement.querySelectorAll("svg")].map(
      (icon) => icon.getBoundingClientRect().width,
    );
    await expect(widths).toHaveLength(SIZES.length);
    await expect(new Set(widths).size).toBe(SIZES.length);
  },
};

/** The surrounding element decides the color: text, an Accent action, or a Module Color. */
export const Colors: StoryObj<typeof meta> = {
  render: () => (
    <Stack gap="xs">
      <Group gap="xl">
        {TEXT_ROLES.map((role) => (
          <Group gap="xs" key={role} style={{ color: roleColor(role) }}>
            <icons.SearchIcon />
            {role}
          </Group>
        ))}
      </Group>
      <Group>
        {BUTTON_VARIANTS.map((variant) => (
          <Button key={variant} leftSection={<icons.AddIcon size="sm" />} variant={variant}>
            {variant}
          </Button>
        ))}
      </Group>
      <Group gap="xl">
        {Object.keys(COLOR_SETS).map((name) => (
          <Group
            data-module-color={name}
            gap="xs"
            key={name}
            style={{ color: "var(--se-module-text)" }}
          >
            <icons.ProjectsIcon />
            {name}
          </Group>
        ))}
      </Group>
    </Stack>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "filled" })).toBeVisible();
    await expect(canvas.getByText("teal")).toBeVisible();
  },
};
