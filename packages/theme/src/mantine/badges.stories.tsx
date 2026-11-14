import { Badge, Group, Stack } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ACCENT_PALETTE, COLOR_SETS, type ResolvedColorMode, roleColor } from "../core/index.ts";
import { COLOR_SET_NAMES } from "../names/index.ts";
import { STATUS_ROLES } from "./story-samples.tsx";

const VARIANTS = ["filled", "light", "outline", "dot", "transparent"] as const;

function BadgeRow({ color }: { readonly color: string }) {
  return (
    <Group gap="xs">
      {VARIANTS.map((variant) => (
        <Badge color={color} key={variant} variant={variant}>
          {color} {variant}
        </Badge>
      ))}
    </Group>
  );
}

function Badges() {
  return (
    <Stack gap="xs">
      <BadgeRow color={ACCENT_PALETTE} />
      {COLOR_SET_NAMES.map((name) => (
        <BadgeRow color={name} key={name} />
      ))}
      <Group gap="xs">
        {STATUS_ROLES.flatMap(({ fill, onFill, soft, text }) => [
          <Badge bg={roleColor(fill)} c={roleColor(onFill)} key={fill}>
            {fill} fill
          </Badge>,
          <Badge bg={roleColor(soft)} c={roleColor(text)} key={soft}>
            {fill} soft
          </Badge>,
        ])}
      </Group>
    </Stack>
  );
}

const meta = {
  title: "Mantine/Badges",
  component: Badges,
} satisfies Meta<typeof Badges>;

export default meta;

export const Overview: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(`${ACCENT_PALETTE} filled`)).toBeVisible();
    await Promise.all(
      COLOR_SET_NAMES.map(async (name) => {
        await expect(canvas.getByText(`${name} transparent`)).toBeVisible();
      }),
    );
    await expect(canvas.getByText("error soft")).toBeVisible();
  },
};

/** The filled variant takes each Color Set's text on the fill, dark on cyan, lime and yellow. */
function expectOwnTextOnFill(canvasElement: HTMLElement, mode: ResolvedColorMode) {
  const canvas = within(canvasElement);
  return Promise.all(
    COLOR_SET_NAMES.map(async (name) => {
      const badge = canvas.getByText(`${name} filled`);
      await expect(badge).toHaveStyle({ color: COLOR_SETS[name][mode].onAccent });
    }),
  );
}

export const FilledLight: StoryObj<typeof meta> = {
  globals: { colorMode: "light" },
  play: async ({ canvasElement }) => {
    await expectOwnTextOnFill(canvasElement, "light");
  },
};

export const FilledDark: StoryObj<typeof meta> = {
  globals: { colorMode: "dark" },
  play: async ({ canvasElement }) => {
    await expectOwnTextOnFill(canvasElement, "dark");
  },
};
