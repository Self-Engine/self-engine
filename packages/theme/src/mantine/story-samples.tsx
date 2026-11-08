// Shared by the stories in this folder. No entry point of the package imports it.

import { Group, Text } from "@mantine/core";
import { COLOR_SETS, type ColorSetId, roleColor } from "../core/index.ts";

export const SET_NAMES = Object.keys(COLOR_SETS) as ColorSetId[];

/** The status Color Roles, which have no Mantine palette: a fill and a soft pair each. */
export const STATUS_ROLES = [
  { fill: "error", onFill: "onError", soft: "errorSoft", text: "errorText" },
  { fill: "warning", onFill: "onWarning", soft: "warningSoft", text: "warningText" },
  { fill: "success", onFill: "onSuccess", soft: "successSoft", text: "successText" },
] as const;

export function isStrictlyIncreasing(values: readonly number[]): boolean {
  return values.every((value, index) => index === 0 || (values[index - 1] ?? value) < value);
}

/** A color next to its name and value. */
export function Swatch({
  color,
  label,
  value,
  testId,
}: {
  readonly color: string;
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
}) {
  return (
    <Group wrap="nowrap">
      <div
        data-testid={testId}
        style={{
          background: color,
          border: `1px solid ${roleColor("border")}`,
          borderRadius: 4,
          height: 32,
          width: 32,
        }}
      />
      <div>
        <Text size="sm">{label}</Text>
        <Text c="dimmed" size="xs">
          {value}
        </Text>
      </div>
    </Group>
  );
}
