// Picking the color of an entry: "no color" and the twelve Color Sets around the color wheel
// (D291). The same circles as the Accent row: the swatch radio group of `ui`.

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { CheckIcon, rem, Stack, Text } from "@mantine/core";
import { colorSetColor, roleColor } from "@self-engine/theme";
import { COLOR_SET_NAMES, type ColorSetName, resolveColorSetName } from "@self-engine/theme/names";
import { useId } from "react";
import { COLOR_SET_LABELS } from "../color-set-labels.ts";
import { type SwatchChoice, SwatchRadioGroup } from "../swatch-radio-group.tsx";

export interface EntryColorPickerProps {
  /** The stored `color`. A text that names no Color Set shows as "no color" and stays stored. */
  readonly value: string | null | undefined;
  /** A Color Set name, which `colorSetNameSchema` accepts, or `null` for "no color". */
  readonly onChange: (color: ColorSetName | null) => void;
  /** The group's visible name; "Color" when left out. */
  readonly label?: string;
}

/** "No color" first, then the Color Sets around the color wheel. */
const CHOICES: readonly (ColorSetName | null)[] = [null, ...COLOR_SET_NAMES];

const NO_COLOR_LABEL = msg`No color`;

/** "No color" as an empty circle with a stroke through it. */
const NO_COLOR_FILL = `linear-gradient(to top right, transparent calc(50% - ${rem(1)}), ${roleColor(
  "textMuted",
)} calc(50% - ${rem(1)}), ${roleColor("textMuted")} calc(50% + ${rem(1)}), transparent calc(50% + ${rem(
  1,
)}))`;

const NO_COLOR_LOOK = {
  color: "transparent",
  c: roleColor("textMuted"),
  style: { backgroundImage: NO_COLOR_FILL, border: `1px solid ${roleColor("border")}` },
} as const;

/** The color of an entry: "no color" first, then the Color Sets. Answers only when chosen. */
export function EntryColorPicker({ value, onChange, label }: EntryColorPickerProps) {
  const { t, i18n } = useLingui();
  const labelId = useId();
  const chosen = resolveColorSetName(value) ?? null;
  const choices = CHOICES.map((colorSet): SwatchChoice<ColorSetName | null> =>
    colorSet === null
      ? { value: null, label: i18n._(NO_COLOR_LABEL), swatch: NO_COLOR_LOOK }
      : {
          value: colorSet,
          label: i18n._(COLOR_SET_LABELS[colorSet]),
          colorSet,
          swatch: {
            color: colorSetColor("accent"),
            c: colorSetColor("onAccent"),
            children: colorSet === chosen && <CheckIcon size={rem(12)} />,
          },
        },
  );
  return (
    <Stack gap={rem(4)}>
      <Text component="span" id={labelId} size="sm">
        {label ?? t`Color`}
      </Text>
      <SwatchRadioGroup choices={choices} labelledBy={labelId} onChange={onChange} value={chosen} />
    </Stack>
  );
}
