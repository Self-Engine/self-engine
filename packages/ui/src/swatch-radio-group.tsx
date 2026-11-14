// A row of colored circles to choose one from: the Accent in the Settings and the color of an
// entry. Built on Mantine's `Radio.Card`, so the arrow keys move through the circles, and not on
// `Radio.Group`, which can only be named by a label of its own and not by a row's title. The
// group is one Tab stop, as a native radio group is. An entry of its own, outside the main entry
// that startup code loads: Mantine's `Radio.Card`, `Tooltip` and `ColorSwatch` would otherwise
// enter the startup bundle, while both users load on demand.

import { ColorSwatch, type ColorSwatchProps, Group, Radio, rem, Tooltip } from "@mantine/core";
import { roleColor } from "@self-engine/theme";
import { useId } from "react";
import { radioTabStop } from "./radio-tab-stop.ts";

/**
 * How a circle looks: its fill (`color`), the color of what it holds (`c`), such as a check mark
 * or an icon, and that content (`children`).
 */
export type SwatchLook = Pick<
  ColorSwatchProps,
  "color" | "c" | "style" | "attributes" | "children"
>;

/** One circle to choose. */
export interface SwatchChoice<V> {
  readonly value: V;
  /** What the tooltip shows and a screen reader reads. */
  readonly label: string;
  /** Shown, but it cannot be chosen. */
  readonly disabled?: boolean;
  /** The Color Set whose scope the card sets, for a circle drawn in `colorSetColor`. */
  readonly colorSet?: string;
  readonly swatch: SwatchLook;
}

export interface SwatchRadioGroupProps<V> {
  readonly choices: readonly SwatchChoice<V>[];
  /** The chosen value; a value none of the choices has leaves the first one the Tab stop. */
  readonly value: V;
  /** Answers the value of the circle the user chose, by a click or the arrow keys. */
  readonly onChange: (value: V) => void;
  /** The id of the element that names the group, such as a row's title. */
  readonly labelledBy: string;
  /** The id of the element that describes the group, such as a message of a form's check. */
  readonly describedBy?: string | undefined;
}

/** The circle grows with the font scale, like the controls around it. */
const SWATCH_SIZE = rem(24);

const CHOSEN_BORDER = roleColor("accentText");

/** Colored circles to choose one from, each with its name as a tooltip. */
export function SwatchRadioGroup<V>({
  choices,
  value,
  onChange,
  labelledBy,
  describedBy,
}: SwatchRadioGroupProps<V>) {
  // What `Radio.Card` moves the arrow keys by.
  const groupName = useId();
  const tabStop = radioTabStop(choices, value);
  return (
    <Group
      aria-describedby={describedBy}
      aria-invalid={describedBy === undefined ? undefined : true}
      aria-labelledby={labelledBy}
      gap={rem(4)}
      role="radiogroup"
    >
      {choices.map((choice) => {
        const chosen = choice.value === value;
        return (
          <Tooltip key={String(choice.value)} label={choice.label}>
            <Radio.Card
              aria-label={choice.label}
              checked={chosen}
              data-color-set={choice.colorSet}
              disabled={choice.disabled}
              // `Radio.Card` moves the arrow keys over every card with the group's name, so a
              // card that cannot be chosen leaves the group for them.
              name={choice.disabled ? `${groupName}-unavailable` : groupName}
              onClick={() => {
                onChange(choice.value);
              }}
              p={rem(2)}
              radius="xl"
              style={{
                borderColor: chosen ? CHOSEN_BORDER : "transparent",
                ...(choice.disabled && { cursor: "not-allowed", opacity: 0.45 }),
              }}
              tabIndex={choice.value === tabStop ? 0 : -1}
              w="auto"
            >
              <ColorSwatch {...choice.swatch} size={SWATCH_SIZE} withShadow={false} />
            </Radio.Card>
          </Tooltip>
        );
      })}
    </Group>
  );
}
