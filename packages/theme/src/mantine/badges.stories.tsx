import { Badge, Group, Stack } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ACCENT_PALETTE, COLOR_SETS, roleColor } from "../core/index.ts";
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
      {Object.keys(COLOR_SETS).map((name) => (
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
      Object.keys(COLOR_SETS).map(async (name) => {
        await expect(canvas.getByText(`${name} transparent`)).toBeVisible();
      }),
    );
    await expect(canvas.getByText("error soft")).toBeVisible();
  },
};
