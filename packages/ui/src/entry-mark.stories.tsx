import { Group, Stack, Text } from "@mantine/core";
import { type IconSize, ProjectsIcon } from "@self-engine/icons";
import { roleColor } from "@self-engine/theme";
import { COLOR_SET_NAMES } from "@self-engine/theme/names";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { EntryMark, type EntryMarkForm } from "./entry-mark.tsx";

const meta = {
  title: "UI/Entry mark",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** What an entry stores in `icon`, and what the mark makes of it. */
const ICONS = [
  ["an icon", "rocket-launch"],
  ["an emoji", "🚀"],
  ["no icon", null],
  ["an unknown icon", "rocket-from-a-newer-version"],
] as const;

/** What an entry stores in `color`: every Color Set, nothing, and a name no Color Set has. */
const COLORS = [...COLOR_SET_NAMES, null, "gray"] as const;

const FORMS = ["bare", "tile"] as const satisfies readonly EntryMarkForm[];

const colorLabel = (color: string | null) => color ?? "no color";

/** One mark, in a wrapper a `play` function can find: the mark itself is hidden from readers. */
function Sample(props: {
  readonly icon: string | null;
  readonly color: string | null;
  readonly form: EntryMarkForm;
  readonly size?: IconSize;
}) {
  const { icon, color, form, size } = props;
  return (
    <span data-testid={`${form} ${colorLabel(color)} ${icon ?? "none"} ${size ?? "md"}`}>
      <EntryMark
        color={color}
        defaultIcon={ProjectsIcon}
        form={form}
        icon={icon}
        {...(size === undefined ? {} : { size })}
      />
    </span>
  );
}

const markIn = (canvasElement: HTMLElement, testId: string) => {
  const wrapper = canvasElement.querySelector(`[data-testid="${testId}"]`);
  const mark = wrapper?.firstElementChild;
  if (!(mark instanceof HTMLElement)) throw new Error(`No mark for ${testId}`);
  return mark;
};

/** A probe that resolves a CSS color the way the page does, for comparison. */
function Probe({ id, color, background }: { id: string; color?: string; background?: string }) {
  return <span data-testid={id} style={{ color, background }} />;
}

const computed = (element: Element) => getComputedStyle(element);

export const BothFormsForEveryColor: Story = {
  render: () => (
    <Stack gap="lg">
      {FORMS.map((form) => (
        <Stack gap="xs" key={form}>
          <Text fw={600}>{form === "bare" ? "Bare tinted icon" : "Soft tile"}</Text>
          {COLORS.map((color) => (
            <Group gap="md" key={colorLabel(color)}>
              <Text c="dimmed" size="sm" w="8rem">
                {colorLabel(color)}
              </Text>
              {ICONS.map(([label, icon]) => (
                <Sample color={color} form={form} icon={icon} key={label} />
              ))}
            </Group>
          ))}
        </Stack>
      ))}
      <Probe background={roleColor("hover")} color={roleColor("textMuted")} id="neutral" />
      {COLOR_SET_NAMES.map((color) => (
        <span data-color-set={color} key={color}>
          <Probe color="var(--se-color-set-text)" id={`text ${color}`} />
        </span>
      ))}
    </Stack>
  ),
  play: async ({ canvasElement, canvas }) => {
    const marks = canvasElement.querySelectorAll('[data-testid^="bare "], [data-testid^="tile "]');
    await expect(marks).toHaveLength(FORMS.length * COLORS.length * ICONS.length);
    for (const form of FORMS) {
      for (const color of COLOR_SET_NAMES) {
        const mark = markIn(canvasElement, `${form} ${color} rocket-launch md`);
        const svg = mark.querySelector("svg");
        await expect(svg).not.toBeNull();
        // The icon carries the Color Set's colored text in both forms (D296).
        const text = computed(canvas.getByTestId(`text ${color}`)).color;
        await expect(computed(svg!).color).toBe(text);
      }
    }
    const neutral = computed(canvas.getByTestId("neutral"));
    for (const form of FORMS) {
      const mark = markIn(canvasElement, `${form} no color rocket-launch md`);
      await expect(computed(mark).color).toBe(neutral.color);
    }
  },
};

export const TheSoftTileSitsOnTheColorSetsSoftFill: Story = {
  render: () => (
    <Group>
      {COLOR_SET_NAMES.map((color) => (
        <span data-color-set={color} key={color}>
          <Sample color={color} form="tile" icon="rocket-launch" />
          <Probe
            background="var(--se-color-set-soft)"
            color="var(--se-color-set-text)"
            id={`probe ${color}`}
          />
        </span>
      ))}
    </Group>
  ),
  play: async ({ canvasElement, canvas }) => {
    for (const color of COLOR_SET_NAMES) {
      const tile = computed(markIn(canvasElement, `tile ${color} rocket-launch md`));
      const probe = computed(canvas.getByTestId(`probe ${color}`));
      await expect(tile.backgroundColor).toBe(probe.backgroundColor);
      await expect(tile.color).toBe(probe.color);
    }
  },
};

export const AnUnknownIconShowsTheUsualIconOfTheKind: Story = {
  render: () => (
    <Group>
      {FORMS.map((form) => (
        <Group key={form}>
          <Sample color="teal" form={form} icon="rocket-from-a-newer-version" />
          <Sample color="teal" form={form} icon={null} />
          <Sample color="teal" form={form} icon="two words" />
        </Group>
      ))}
      <span data-testid="usual">
        <ProjectsIcon />
      </span>
    </Group>
  ),
  play: async ({ canvasElement, canvas }) => {
    const usual = canvas.getByTestId("usual").innerHTML;
    for (const form of FORMS) {
      for (const icon of ["rocket-from-a-newer-version", "none", "two words"]) {
        const svg = markIn(canvasElement, `${form} teal ${icon} md`).querySelector("svg");
        await expect(svg?.outerHTML).toBe(usual);
      }
    }
  },
};

export const AnUnknownColorLooksNeutral: Story = {
  render: () => (
    <Group data-color-set="violet">
      {FORMS.map((form) => (
        <Group key={form}>
          <Sample color="gray" form={form} icon="rocket-launch" />
          <Sample color={null} form={form} icon="rocket-launch" />
          <Sample color="#ff0000" form={form} icon="rocket-launch" />
        </Group>
      ))}
      <Probe background={roleColor("hover")} color={roleColor("textMuted")} id="neutral" />
    </Group>
  ),
  play: async ({ canvasElement, canvas }) => {
    // Inside a Module Color's scope too: a mark without a color does not take the module's.
    const neutral = computed(canvas.getByTestId("neutral"));
    for (const form of FORMS) {
      for (const color of ["gray", "no color", "#ff0000"]) {
        const mark = markIn(canvasElement, `${form} ${color} rocket-launch md`);
        await expect(computed(mark).color).toBe(neutral.color);
        if (form === "tile") {
          await expect(computed(mark).backgroundColor).toBe(neutral.backgroundColor);
        }
      }
    }
  },
};

export const AnEmojiKeepsItsOwnColors: Story = {
  render: () => (
    <Group>
      {FORMS.map((form) => (
        <Group key={form}>
          <Sample color="yellow" form={form} icon="🚀" />
          <Sample color={null} form={form} icon="👩‍👩‍👧" />
        </Group>
      ))}
    </Group>
  ),
  play: async ({ canvasElement }) => {
    for (const form of FORMS) {
      const rocket = markIn(canvasElement, `${form} yellow 🚀 md`);
      await expect(rocket).toHaveTextContent("🚀");
      await expect(rocket.querySelector("svg")).toBeNull();
      await expect(markIn(canvasElement, `${form} no color 👩‍👩‍👧 md`)).toHaveTextContent("👩‍👩‍👧");
    }
  },
};

const SIZES = ["xs", "sm", "md", "lg", "xl"] as const satisfies readonly IconSize[];

export const TheFiveSizesOfTheIconCatalog: Story = {
  render: () => (
    <Stack>
      {SIZES.map((size) => (
        <Group key={size}>
          {FORMS.map((form) => (
            <Group key={form}>
              <Sample color="blue" form={form} icon="rocket-launch" size={size} />
              <Sample color="blue" form={form} icon="🚀" size={size} />
            </Group>
          ))}
          <span data-testid={`catalog ${size}`}>
            <ProjectsIcon size={size} />
          </span>
        </Group>
      ))}
    </Stack>
  ),
  play: async ({ canvasElement, canvas }) => {
    for (const size of SIZES) {
      const catalog = canvas.getByTestId(`catalog ${size}`).querySelector("svg")!;
      const side = catalog.getBoundingClientRect().width;
      for (const form of FORMS) {
        const svg = markIn(canvasElement, `${form} blue rocket-launch ${size}`).querySelector(
          "svg",
        )!;
        await expect(svg.getBoundingClientRect().width).toBe(side);
        // Drawn in the duotone weight: a filled layer at a fifth of the opacity.
        await expect(svg.querySelector('path[opacity="0.2"]')).not.toBeNull();
        const emoji = markIn(canvasElement, `${form} blue 🚀 ${size}`);
        const tile = markIn(canvasElement, `${form} blue rocket-launch ${size}`);
        await expect(emoji.getBoundingClientRect().width).toBe(tile.getBoundingClientRect().width);
      }
    }
  },
};
