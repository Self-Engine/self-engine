import { Stack } from "@mantine/core";
import { entryIconSchema, type IconName } from "@self-engine/icons/names";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { afterTheCommitsNowDue, difference, renderCounts } from "../story-render-counts.ts";
import { EntryIconPicker } from "./index.ts";

const meta = {
  title: "UI/Entry pickers/Icon",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The picker in a form that keeps what it answers, as an edit drawer would. */
function Form({
  stored,
  answer,
}: {
  readonly stored: string | null;
  readonly answer: (value: IconName | null) => void;
}) {
  const [value, setValue] = useState<string | null>(stored);
  return (
    <Stack>
      <EntryIconPicker
        onChange={(next) => {
          answer(next);
          setValue(next);
        }}
        value={value}
      />
      <output data-testid="stored">{value ?? "nothing"}</output>
    </Stack>
  );
}

const answers = fn<(value: IconName | null) => void>();

/** Every answer the picker gave passes the strict schema, or is empty. */
async function expectStrict() {
  for (const [value] of answers.mock.calls) {
    if (value !== null) await expect(entryIconSchema.safeParse(value).success).toBe(true);
  }
}

const trigger = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("button", { name: /^Icon/ });

/** The open picker: its search field and its grid of pictures. */
async function opened() {
  const dialog = await screen.findByRole("dialog", { name: "Choose an icon" });
  const picker = within(dialog);
  return {
    dialog,
    picker,
    search: picker.getByRole("searchbox", { name: "Search icons" }),
    grid: picker.getByRole("listbox", { name: "Icons" }),
  };
}

const shownOptions = (grid: HTMLElement) =>
  within(grid)
    .queryAllByRole("option")
    .map((option) => option.getAttribute("aria-label"));

export const ChoosesSearchesAndClears: Story = {
  render: () => <Form answer={answers} stored="house" />,
  play: async ({ canvas }) => {
    answers.mockClear();
    // The trigger names the current icon.
    await expect(trigger(canvas)).toHaveAccessibleName("Icon House");
    await userEvent.click(trigger(canvas));
    const { grid, dialog } = await opened();
    await expect(within(grid).getAllByRole("option")).toHaveLength(107);
    // The current icon is marked.
    await expect(within(grid).getByRole("option", { name: "House" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(within(grid).getAllByRole("option", { selected: true })).toHaveLength(1);

    await userEvent.click(within(grid).getByRole("option", { name: "Rocket" }));
    await expect(answers).toHaveBeenLastCalledWith("rocket-launch");
    await waitFor(() => expect(dialog.isConnected).toBe(false));
    await expect(trigger(canvas)).toHaveAccessibleName("Icon Rocket");

    // A search by a label finds the picture, whatever the case and wherever it is in the label.
    await userEvent.click(trigger(canvas));
    const second = await opened();
    await userEvent.type(second.search, "BANK");
    await expect(shownOptions(second.grid)).toEqual(["Bank", "Banknote", "Piggy bank"]);
    await userEvent.clear(second.search);
    await userEvent.type(second.search, "no picture is called this");
    await expect(shownOptions(second.grid)).toEqual([]);
    await expect(second.picker.getByText("No icon matches the search.")).toBeVisible();
    await userEvent.clear(second.search);
    await userEvent.type(second.search, "piggy");
    await userEvent.click(within(second.grid).getByRole("option", { name: "Piggy bank" }));
    await expect(answers).toHaveBeenLastCalledWith("piggy-bank");

    // The value can be cleared.
    await userEvent.click(trigger(canvas));
    const third = await opened();
    await userEvent.click(third.picker.getByRole("button", { name: "No icon" }));
    await expect(answers).toHaveBeenLastCalledWith(null);
    await expect(canvas.getByTestId("stored")).toHaveTextContent("nothing");
    await expect(trigger(canvas)).toHaveAccessibleName("Icon No icon");
    await expectStrict();
  },
};

export const ChoosesWithTheKeyboardAlone: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    answers.mockClear();
    await userEvent.tab();
    await expect(trigger(canvas)).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const { grid, search } = await opened();
    // The search field takes the focus, so typing filters at once.
    await waitFor(() => expect(search).toHaveFocus());
    await userEvent.keyboard("circle");
    const found = shownOptions(grid);
    await expect(found).toEqual(["Circle", "Dashed circle", "Half circle"]);
    // Down from the search goes into the pictures, the arrows move through them.
    await userEvent.keyboard("{ArrowDown}");
    await expect(within(grid).getByRole("option", { name: found[0]! })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowLeft}");
    await expect(within(grid).getByRole("option", { name: found[1]! })).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(within(grid).getByRole("option", { name: found.at(-1)! })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(within(grid).getByRole("option", { name: "Circle" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(answers).toHaveBeenLastCalledWith("circle");
    await waitFor(() => expect(trigger(canvas)).toHaveFocus());

    // Without a search, Up and Down move by a row of the grid.
    await userEvent.keyboard("{Enter}");
    const again = await opened();
    await waitFor(() => expect(again.search).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    const chosen = within(again.grid).getByRole("option", { selected: true });
    await expect(chosen).toHaveFocus();
    const options = within(again.grid).getAllByRole("option");
    const columns = options.filter((option) => option.offsetTop === options[0]!.offsetTop).length;
    const at = options.indexOf(chosen);
    await userEvent.keyboard("{ArrowDown}");
    await expect(options[at + columns]).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    await expect(chosen).toHaveFocus();
    // Up from the first row goes back to the search.
    await userEvent.keyboard("{Home}{ArrowUp}");
    await expect(again.search).toHaveFocus();
    // Escape closes without a choice.
    const before = answers.mock.calls.length;
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger(canvas)).toHaveFocus());
    await expect(answers).toHaveBeenCalledTimes(before);
    await expectStrict();
  },
};

export const AnUnknownStoredIconShowsAsNothingChosen: Story = {
  render: () => (
    <Stack>
      {["a-picture-from-a-newer-version", "🌱"].map((stored) => (
        <div data-testid={stored} key={stored}>
          <Form answer={answers} stored={stored} />
        </div>
      ))}
    </Stack>
  ),
  play: async ({ canvas }) => {
    answers.mockClear();
    for (const stored of ["a-picture-from-a-newer-version", "🌱"]) {
      const form = within(canvas.getByTestId(stored));
      await expect(trigger(form)).toHaveAccessibleName("Icon No icon");
      await userEvent.click(trigger(form));
      const { grid } = await opened();
      await expect(within(grid).queryAllByRole("option", { selected: true })).toHaveLength(0);
      // Looking is not a choice: the stored value stays until the user acts.
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await expect(form.getByTestId("stored")).toHaveTextContent(stored);
    }
    await expect(answers).not.toHaveBeenCalled();
  },
};

export const ClearsAnUnknownStoredIconButNotAnEmoji: Story = {
  render: () => (
    <Stack>
      {["a-picture-from-a-newer-version", "🌱", "empty"].map((stored) => (
        <div data-testid={stored} key={stored}>
          <Form answer={answers} stored={stored === "empty" ? null : stored} />
        </div>
      ))}
    </Stack>
  ),
  play: async ({ canvas }) => {
    answers.mockClear();
    // An emoji is cleared in the emoji field, and an empty value has nothing to clear.
    for (const stored of ["🌱", "empty"]) {
      await userEvent.click(trigger(within(canvas.getByTestId(stored))));
      const { picker } = await opened();
      await expect(picker.getByRole("button", { name: "No icon" })).toBeDisabled();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
    await expect(answers).not.toHaveBeenCalled();

    // A name this version does not know is still stored, so it can be cleared.
    const unknown = within(canvas.getByTestId("a-picture-from-a-newer-version"));
    await userEvent.click(trigger(unknown));
    const { picker } = await opened();
    await userEvent.click(picker.getByRole("button", { name: "No icon" }));
    await expect(answers).toHaveBeenLastCalledWith(null);
    await expect(unknown.getByTestId("stored")).toHaveTextContent("nothing");
  },
};

/** The name the render count gives the grid's pictures. */
const PICTURE = "PictureOption";

export const AMoveOfTheFocusRedrawsTwoPictures: Story = {
  render: () => <Form answer={answers} stored="house" />,
  play: async ({ canvas }) => {
    await userEvent.click(trigger(canvas));
    const { grid, search } = await opened();
    await waitFor(() => expect(search).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    const chosen = within(grid).getByRole("option", { name: "House" });
    await expect(chosen).toHaveFocus();
    await afterTheCommitsNowDue();
    const before = renderCounts();

    // The focus leaves one picture and reaches the next: those two redraw, the other 105 do not.
    await userEvent.keyboard("{ArrowRight}");
    await expect(chosen).not.toHaveFocus();
    await afterTheCommitsNowDue();
    await expect(difference(renderCounts(), before).components[PICTURE]).toBe(2);
  },
};

export const SearchesInGerman: Story = {
  globals: { language: "de" },
  render: () => <Form answer={answers} stored="barbell" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /^Icon/ })).toHaveAccessibleName("Icon Hantel");
    await userEvent.click(canvas.getByRole("button", { name: /^Icon/ }));
    const dialog = await screen.findByRole("dialog", { name: "Icon wählen" });
    const search = within(dialog).getByRole("searchbox", { name: "Icons durchsuchen" });
    await userEvent.type(search, "gluhbirne");
    const grid = within(dialog).getByRole("listbox", { name: "Icons" });
    await expect(shownOptions(grid)).toEqual(["Glühbirne"]);
  },
};

/** Mantine's height of size `xs` at the 100 % font scale, which the compact Density gives controls. */
const COMPACT_CONTROL_HEIGHT = 30;

export const FollowsTheCompactDensity: Story = {
  globals: { density: "compact", fontScale: "100" },
  render: () => (
    <Stack>
      <Form answer={answers} stored="house" />
      <div data-testid="row" style={{ height: "var(--se-row-height)" }} />
    </Stack>
  ),
  play: async ({ canvas }) => {
    await expect(trigger(canvas).getBoundingClientRect().height).toBe(COMPACT_CONTROL_HEIGHT);
    await userEvent.click(trigger(canvas));
    const { grid, search } = await opened();
    await expect(search.getBoundingClientRect().height).toBe(COMPACT_CONTROL_HEIGHT);
    // A picture is at least as wide as a row of the Density is high, and square.
    const row = canvas.getByTestId("row").getBoundingClientRect().height;
    const cell = within(grid).getByRole("option", { name: "House" }).getBoundingClientRect();
    await expect(cell.width).toBeGreaterThanOrEqual(row);
    await expect(Math.round(cell.height)).toBe(Math.round(cell.width));
  },
};
