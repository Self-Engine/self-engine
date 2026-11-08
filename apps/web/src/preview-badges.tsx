// The badges of the throwaway /theme-preview page. #23 removes it.

import { Badge, Group, Stack } from "@mantine/core";
import { ACCENT_PALETTE, COLOR_SETS } from "@self-engine/theme";
import { roleColor } from "./preview-role-color.ts";

const VARIANTS = ["filled", "light", "outline", "dot", "transparent"] as const;

/** The status Color Roles, which have no Mantine palette: a fill and a soft pair each. */
const STATUS_BADGES = [
  { fill: "error", onFill: "onError", soft: "errorSoft", text: "errorText" },
  { fill: "warning", onFill: "onWarning", soft: "warningSoft", text: "warningText" },
  { fill: "success", onFill: "onSuccess", soft: "successSoft", text: "successText" },
] as const;

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

export function BadgesPreview() {
  return (
    <Stack gap="xs">
      <BadgeRow color={ACCENT_PALETTE} />
      {Object.keys(COLOR_SETS).map((name) => (
        <BadgeRow color={name} key={name} />
      ))}
      <Group gap="xs">
        {STATUS_BADGES.flatMap(({ fill, onFill, soft, text }) => [
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
