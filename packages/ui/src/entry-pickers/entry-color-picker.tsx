// Picking the color of an entry: "no color" and the twelve Color Sets around the color wheel
// (D291). Built like the Accent row, on Mantine's `Radio.Card`, so the arrow keys move through the
// colors and the group is one Tab stop.

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { CheckIcon, ColorSwatch, Group, Radio, rem, Stack, Text, Tooltip } from "@mantine/core";
import { colorSetColor, roleColor } from "@self-engine/theme";
import { COLOR_SET_NAMES, type ColorSetName, resolveColorSetName } from "@self-engine/theme/names";
import { useId } from "react";
import { COLOR_SET_LABELS } from "../color-set-labels.ts";
import { radioTabStop } from "../radio-tab-stop.ts";

export interface EntryColorPickerProps {
  /** The stored `color`. A text that names no Color Set shows as "no color" and stays stored. */
  readonly value: string | null | undefined;
  /** A Color Set name, which `colorSetNameSchema` accepts, or `null` for "no color". */
  readonly onChange: (color: ColorSetName | null) => void;
  /** The group's visible name; "Color" when left out. */
  readonly label?: string;
}

/** The value of "no color" among the cards, which no Color Set name can be. */
const NO_COLOR = "";

const CHOICES = [NO_COLOR, ...COLOR_SET_NAMES].map((value) => ({ value }));

const NO_COLOR_LABEL = msg`No color`;

/** The swatch grows with the font scale, like the controls around it. */
const SWATCH_SIZE = rem(24);

/** "No color" as an empty circle with a stroke through it. */
const NO_COLOR_FILL = `linear-gradient(to top right, transparent calc(50% - ${rem(1)}), ${roleColor(
  "textMuted",
)} calc(50% - ${rem(1)}), ${roleColor("textMuted")} calc(50% + ${rem(1)}), transparent calc(50% + ${rem(
  1,
)}))`;

/** The color of an entry: "no color" first, then the Color Sets. Answers only when chosen. */
export function EntryColorPicker({ value, onChange, label }: EntryColorPickerProps) {
  const { t, i18n } = useLingui();
  const groupName = useId();
  const labelId = useId();
  const chosen = resolveColorSetName(value) ?? NO_COLOR;
  const tabStop = radioTabStop(CHOICES, chosen);
  return (
    <Stack gap={rem(4)}>
      <Text component="span" id={labelId} size="sm">
        {label ?? t`Color`}
      </Text>
      <Group aria-labelledby={labelId} gap={rem(4)} role="radiogroup">
        {CHOICES.map(({ value: choice }) => {
          const colorSet = choice === NO_COLOR ? undefined : (choice as ColorSetName);
          const name = i18n._(colorSet === undefined ? NO_COLOR_LABEL : COLOR_SET_LABELS[colorSet]);
          const isChosen = choice === chosen;
          return (
            <Tooltip key={choice} label={name}>
              <Radio.Card
                aria-label={name}
                checked={isChosen}
                data-color-set={colorSet}
                name={groupName}
                onClick={() => {
                  onChange(colorSet ?? null);
                }}
                p={rem(2)}
                radius="xl"
                style={{ borderColor: isChosen ? roleColor("accentText") : "transparent" }}
                tabIndex={choice === tabStop ? 0 : -1}
                w="auto"
              >
                <ColorSwatch
                  c={colorSet === undefined ? roleColor("textMuted") : colorSetColor("onAccent")}
                  color={colorSet === undefined ? "transparent" : colorSetColor("accent")}
                  size={SWATCH_SIZE}
                  style={
                    colorSet === undefined
                      ? {
                          backgroundImage: NO_COLOR_FILL,
                          border: `1px solid ${roleColor("border")}`,
                        }
                      : undefined
                  }
                  withShadow={false}
                >
                  {isChosen && colorSet !== undefined && <CheckIcon size={rem(12)} />}
                </ColorSwatch>
              </Radio.Card>
            </Tooltip>
          );
        })}
      </Group>
    </Stack>
  );
}
