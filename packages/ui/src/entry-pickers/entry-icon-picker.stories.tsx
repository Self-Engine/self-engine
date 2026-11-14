import { useLingui } from "@lingui/react";
import { Button, Stack } from "@mantine/core";
import { activateLanguage } from "@self-engine/i18n";
import { entryIconSchema } from "@self-engine/icons/names";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { afterTheCommitsNowDue, difference, renderCounts } from "../story-render-counts.ts";
import { EntryIconPicker } from "./index.ts";

const meta = {
  title: "UI/Entry pickers/Icon",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The field in a form that keeps what it answers, as an edit drawer would. */
function Form({
  stored,
  answer,
}: {
  readonly stored: string | null;
  readonly answer: (value: string | null) => void;
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

const answers = fn<(value: string | null) => void>();

/** Every answer the field gave passes the strict schema, or is empty. */
async function expectStrict() {
  for (const [value] of answers.mock.calls) {
    if (value !== null) await expect(entryIconSchema.safeParse(value).success).toBe(true);
  }
}

const trigger = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("button", { name: /^Icon/ });

/** The open field: its dialog, the tab shown, and the controls of the Icons tab if it is shown. */
async function opened(name = "Choose an icon") {
  const dialog = await screen.findByRole("dialog", { name });
  const picker = within(dialog);
  return {
    dialog,
    picker,
    selectedTab: () => picker.getByRole("tab", { selected: true }),
    search: () => picker.getByRole("searchbox", { name: "Search icons" }),
    grid: () => picker.getByRole("listbox", { name: "Icons" }),
  };
}

/** The Emoji tab once its picker and data have loaded: its search field and its grid. */
async function emojiTab(dialog: HTMLElement, names = { search: "Search emojis", grid: "Emojis" }) {
  const picker = within(dialog);
  const grid = await picker.findByRole("grid", { name: names.grid }, { timeout: 10_000 });
  return { grid, search: picker.getByRole("searchbox", { name: names.search }) };
}

const shownOptions = (grid: HTMLElement) =>
  within(grid)
    .queryAllByRole("option")
    .map((option) => option.getAttribute("aria-label"));

const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

export const ChoosesSearchesAndClears: Story = {
  render: () => <Form answer={answers} stored="house" />,
  play: async ({ canvas }) => {
    answers.mockClear();
    // The trigger names the current icon.
    await expect(trigger(canvas)).toHaveAccessibleName("Icon House");
    await userEvent.click(trigger(canvas));
    const { dialog, grid, selectedTab } = await opened();
    // A stored icon opens on the Icons tab.
    await expect(selectedTab()).toHaveAccessibleName("Icons");
    await expect(within(grid()).getAllByRole("option")).toHaveLength(107);
    // The current icon is marked.
    await expect(within(grid()).getByRole("option", { name: "House" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(within(grid()).getAllByRole("option", { selected: true })).toHaveLength(1);

    await userEvent.click(within(grid()).getByRole("option", { name: "Rocket" }));
    await expect(answers).toHaveBeenLastCalledWith("rocket-launch");
    await waitFor(() => expect(dialog.isConnected).toBe(false));
    await expect(trigger(canvas)).toHaveAccessibleName("Icon Rocket");

    // A search by a label finds the picture, whatever the case and wherever it is in the label.
    await userEvent.click(trigger(canvas));
    const second = await opened();
    await userEvent.type(second.search(), "BANK");
    await expect(shownOptions(second.grid())).toEqual(["Bank", "Banknote", "Piggy bank"]);
    await userEvent.clear(second.search());
    await userEvent.type(second.search(), "no picture is called this");
    await expect(shownOptions(second.grid())).toEqual([]);
    await expect(second.picker.getByText("No icon matches the search.")).toBeVisible();
    await userEvent.clear(second.search());
    await userEvent.type(second.search(), "piggy");
    await userEvent.click(within(second.grid()).getByRole("option", { name: "Piggy bank" }));
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

export const ChoosesAnEmojiFromTheGridAndClearsIt: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    answers.mockClear();
    await userEvent.click(trigger(canvas));
    const first = await opened();
    // Nothing stored opens on the Icons tab.
    await expect(first.selectedTab()).toHaveAccessibleName("Icons");
    await userEvent.click(first.picker.getByRole("tab", { name: "Emoji" }));
    const { grid } = await emojiTab(first.dialog);
    // The grid shows the first category without a search.
    await userEvent.click(within(grid).getByRole("gridcell", { name: "grinning face" }));
    await expect(answers).toHaveBeenLastCalledWith("😀");
    await closed();
    await expect(trigger(canvas)).toHaveAccessibleName("Icon 😀");
    await expect(canvas.getByTestId("stored")).toHaveTextContent("😀");

    // A stored emoji opens on the Emoji tab, and "No icon" clears it.
    await userEvent.click(trigger(canvas));
    const second = await opened();
    await expect(second.selectedTab()).toHaveAccessibleName("Emoji");
    await userEvent.click(second.picker.getByRole("button", { name: "No icon" }));
    await expect(answers).toHaveBeenLastCalledWith(null);
    await expect(canvas.getByTestId("stored")).toHaveTextContent("nothing");
    await expect(trigger(canvas)).toHaveAccessibleName("Icon No icon");
    await expectStrict();
  },
};

/** The active translation, switched to German by a button, as the Settings switch it. */
function SwitchesToGerman() {
  const { i18n } = useLingui();
  return (
    <Button
      onClick={() => {
        void activateLanguage(i18n, "de");
      }}
    >
      Deutsch
    </Button>
  );
}

export const SearchesEmojisByNameAndFollowsTheLanguage: Story = {
  globals: { language: "en" },
  render: () => (
    <Stack>
      <SwitchesToGerman />
      <Form answer={answers} stored="🏠" />
    </Stack>
  ),
  play: async ({ canvas }) => {
    answers.mockClear();
    await userEvent.click(trigger(canvas));
    const english = await opened();
    const tab = await emojiTab(english.dialog);
    await expect(
      english.picker.getByRole("button", { name: "Smileys & People" }),
    ).toBeInTheDocument();
    await userEvent.type(tab.search, "house");
    await expect(within(tab.grid).getByRole("gridcell", { name: "house" })).toHaveTextContent("🏠");
    await userEvent.keyboard("{Escape}");
    await closed();

    // After a switch of the language, the labels, the categories and the names are German.
    await userEvent.click(canvas.getByRole("button", { name: "Deutsch" }));
    await waitFor(() => expect(trigger(canvas)).toHaveAccessibleName("Icon 🏠"));
    await userEvent.click(trigger(canvas));
    const german = await opened("Icon wählen");
    await expect(german.picker.getByRole("tab", { name: "Icons" })).toBeInTheDocument();
    const deTab = await emojiTab(german.dialog, { search: "Emojis durchsuchen", grid: "Emojis" });
    await expect(
      german.picker.getByRole("button", { name: "Smileys & Menschen" }),
    ).toBeInTheDocument();
    await expect(german.picker.getByRole("button", { name: "Hautton" })).toBeInTheDocument();
    await userEvent.type(deTab.search, "Haus");
    // The house is found by its German name.
    await expect(within(deTab.grid).getByRole("gridcell", { name: "Haus" })).toHaveTextContent(
      "🏠",
    );
    await userEvent.click(within(deTab.grid).getByRole("gridcell", { name: "Haus" }));
    await expect(answers).toHaveBeenLastCalledWith("🏠");
    await userEvent.click(trigger(canvas));
    const again = await opened("Icon wählen");
    const lastTab = await emojiTab(again.dialog, { search: "Emojis durchsuchen", grid: "Emojis" });
    await userEvent.type(lastTab.search, "no emoji is called this");
    await expect(again.picker.getByText("Kein Emoji passt zur Suche.")).toBeVisible();
    await expectStrict();
  },
};

export const KeepsTheSearchTermAcrossTheTabs: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    answers.mockClear();
    await userEvent.click(trigger(canvas));
    const { dialog, picker, search, grid } = await opened();
    // A term typed under "Icons" is the term under "Emoji", with its results.
    await userEvent.type(search(), "house");
    await expect(shownOptions(grid())).toEqual(["House"]);
    await userEvent.click(picker.getByRole("tab", { name: "Emoji" }));
    const emoji = await emojiTab(dialog);
    await expect(emoji.search).toHaveValue("house");
    await expect(within(emoji.grid).getByRole("gridcell", { name: "house" })).toHaveTextContent(
      "🏠",
    );

    // And the other way round.
    await userEvent.clear(emoji.search);
    await userEvent.type(emoji.search, "rocket");
    await expect(within(emoji.grid).getByRole("gridcell", { name: "rocket" })).toHaveTextContent(
      "🚀",
    );
    await userEvent.click(picker.getByRole("tab", { name: "Icons" }));
    await expect(search()).toHaveValue("rocket");
    await expect(shownOptions(grid())).toEqual(["Rocket"]);

    // The next opening starts with an empty search.
    await userEvent.keyboard("{Escape}");
    await closed();
    await userEvent.click(trigger(canvas));
    const again = await opened();
    await expect(again.search()).toHaveValue("");
    await expect(answers).not.toHaveBeenCalled();
  },
};

export const TakesAPastedEmojiInBothTabs: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    answers.mockClear();
    // Under "Icons": an emoji with a skin tone, pasted with space around it.
    await userEvent.click(trigger(canvas));
    const first = await opened();
    await userEvent.click(first.search());
    await userEvent.paste(" 👍🏽 ");
    await expect(answers).toHaveBeenLastCalledWith("👍🏽");
    await closed();
    await expect(trigger(canvas)).toHaveAccessibleName("Icon 👍🏽");

    // Under "Emoji", which a stored emoji opens on: a joined emoji of several parts.
    await userEvent.click(trigger(canvas));
    const second = await opened();
    await expect(second.selectedTab()).toHaveAccessibleName("Emoji");
    const tab = await emojiTab(second.dialog);
    await expect(tab.search).toHaveValue("");
    await userEvent.click(tab.search);
    await userEvent.paste("🧑🏿‍🚀");
    await expect(answers).toHaveBeenLastCalledWith("🧑🏿‍🚀");
    await closed();
    await expect(canvas.getByTestId("stored")).toHaveTextContent("🧑🏿‍🚀");

    // The next opening shows an empty search in both tabs.
    await userEvent.click(trigger(canvas));
    const third = await opened();
    const again = await emojiTab(third.dialog);
    await expect(again.search).toHaveValue("");
    await userEvent.click(third.picker.getByRole("tab", { name: "Icons" }));
    await expect(third.search()).toHaveValue("");
    await expect(answers).toHaveBeenCalledTimes(2);
    await expectStrict();
  },
};

export const KeepsMixedTextAsASearchTerm: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    answers.mockClear();
    await userEvent.click(trigger(canvas));
    const { dialog, picker, search } = await opened();
    for (const term of ["😀 house", "😀😀", "abc😀"]) {
      await userEvent.clear(search());
      await userEvent.click(search());
      await userEvent.paste(term);
      await expect(search()).toHaveValue(term);
    }
    await userEvent.click(picker.getByRole("tab", { name: "Emoji" }));
    // The last term came along to the Emoji tab, where it stays a search term too. It finds no
    // emoji, so the picker shows no grid.
    const emojiSearch = await picker.findByRole(
      "searchbox",
      { name: "Search emojis" },
      { timeout: 10_000 },
    );
    await expect(emojiSearch).toHaveValue("abc😀");
    await userEvent.clear(emojiSearch);
    await userEvent.click(emojiSearch);
    await userEvent.paste("😀 house");
    await expect(emojiSearch).toHaveValue("😀 house");
    await expect(dialog).toBeVisible();
    await expect(answers).not.toHaveBeenCalled();
  },
};

export const TakesAComposedEmojiOnlyOnceItIsComposed: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    answers.mockClear();
    await userEvent.click(trigger(canvas));
    const { search } = await opened();
    // An input method shows an emoji as a candidate while the user still composes.
    await fireEvent.compositionStart(search());
    await fireEvent.input(search(), { target: { value: "🍣" } });
    await expect(search()).toHaveValue("🍣");
    await expect(answers).not.toHaveBeenCalled();
    // Once the composition ends with the emoji, it is the choice.
    await fireEvent.compositionEnd(search());
    await expect(answers).toHaveBeenLastCalledWith("🍣");
    // Some browsers send the composed text once more after the end: it is not a second answer.
    await fireEvent.input(search(), { target: { value: "🍣" } });
    await expect(answers).toHaveBeenCalledTimes(1);
    await closed();
    await expectStrict();
  },
};

export const ChoosesASkinTone: Story = {
  render: () => <Form answer={answers} stored="👋" />,
  play: async ({ canvas }) => {
    answers.mockClear();
    await userEvent.click(trigger(canvas));
    const { dialog, picker } = await opened();
    const { search } = await emojiTab(dialog);
    await userEvent.type(search, "thumbs up");
    await expect(picker.getByRole("gridcell", { name: "thumbs up" })).toHaveTextContent(/^👍$/u);
    // The tone applies to the emojis shown.
    await userEvent.click(picker.getByRole("button", { name: "Skin tone" }));
    await userEvent.click(await picker.findByRole("button", { name: "Medium skin tone" }));
    const thumbs = picker.getByRole("gridcell", { name: "thumbs up" });
    await expect(thumbs).toHaveTextContent("👍🏽");
    await userEvent.click(thumbs);
    await expect(answers).toHaveBeenLastCalledWith("👍🏽");
    // The tone is not remembered: the next opening starts without one.
    await userEvent.click(trigger(canvas));
    const again = await opened();
    const second = await emojiTab(again.dialog);
    await userEvent.type(second.search, "thumbs up");
    await expect(
      await again.picker.findByRole("gridcell", { name: "thumbs up" }),
    ).toHaveTextContent(/^👍$/u);
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
    await waitFor(() => expect(search()).toHaveFocus());
    await userEvent.keyboard("circle");
    const found = shownOptions(grid());
    await expect(found).toEqual(["Circle", "Dashed circle", "Half circle"]);
    // Down from the search goes into the pictures, the arrows move through them.
    await userEvent.keyboard("{ArrowDown}");
    await expect(within(grid()).getByRole("option", { name: found[0]! })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowLeft}");
    await expect(within(grid()).getByRole("option", { name: found[1]! })).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(within(grid()).getByRole("option", { name: found.at(-1)! })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(within(grid()).getByRole("option", { name: "Circle" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(answers).toHaveBeenLastCalledWith("circle");
    await waitFor(() => expect(trigger(canvas)).toHaveFocus());

    // Without a search, Up and Down move by a row of the grid.
    await userEvent.keyboard("{Enter}");
    const again = await opened();
    await waitFor(() => expect(again.search()).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    const chosen = within(again.grid()).getByRole("option", { selected: true });
    await expect(chosen).toHaveFocus();
    const options = within(again.grid()).getAllByRole("option");
    const columns = options.filter((option) => option.offsetTop === options[0]!.offsetTop).length;
    const at = options.indexOf(chosen);
    await userEvent.keyboard("{ArrowDown}");
    await expect(options[at + columns]).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    await expect(chosen).toHaveFocus();
    // Up from the first row goes back to the search.
    await userEvent.keyboard("{Home}{ArrowUp}");
    await expect(again.search()).toHaveFocus();
    // Escape closes without a choice.
    const before = answers.mock.calls.length;
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger(canvas)).toHaveFocus());
    await expect(answers).toHaveBeenCalledTimes(before);
    await expectStrict();
  },
};

/** The emoji the grid's keyboard focus is on, by the grid's active descendant. */
function activeEmoji(owner: HTMLElement): HTMLElement | null {
  const id = owner.getAttribute("aria-activedescendant");
  return id === null ? null : document.getElementById(id);
}

export const ReachesEveryEmojiWithTheKeyboardAlone: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    answers.mockClear();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const { dialog, picker, search } = await opened();
    await waitFor(() => expect(search()).toHaveFocus());
    // Back to the tabs, over to "Emoji", and on into the picker's search field.
    await userEvent.tab({ shift: true });
    await expect(picker.getByRole("tab", { name: "Icons" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(picker.getByRole("tab", { name: "Emoji", selected: true })).toHaveFocus();
    const tab = await emojiTab(dialog);
    await userEvent.tab();
    await expect(tab.search).toHaveFocus();

    // From the search, Down walks the rows of the results and Enter chooses.
    await userEvent.keyboard("face");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const second = activeEmoji(tab.search);
    await expect(second).not.toBeNull();
    await userEvent.keyboard("{Enter}");
    await expect(answers).toHaveBeenLastCalledWith(second!.textContent);
    await closed();
    await waitFor(() => expect(trigger(canvas)).toHaveFocus());

    // Without a search term, the keyboard reaches the grid itself: the field opens on "Emoji",
    // where the emoji now stored lives, with the focus in the empty search; Tab passes the
    // categories and lands in the grid.
    await userEvent.keyboard("{Enter}");
    const again = await opened();
    await expect(again.selectedTab()).toHaveAccessibleName("Emoji");
    const all = await emojiTab(again.dialog);
    await waitFor(() => expect(all.search).toHaveFocus());
    await expect(all.search).toHaveValue("");
    await userEvent.tab();
    await expect(again.picker.getByRole("button", { name: "Smileys & People" })).toHaveFocus();
    await userEvent.tab();
    await expect(all.grid).toHaveFocus();
    // In the grid, Down reaches the last row and Right the last emoji of the list.
    // Down from the last row stays there, so the walk ends when Down changes nothing.
    let previous: string | undefined;
    for (let step = 0; step < 400; step += 1) {
      await userEvent.keyboard("{ArrowDown}");
      const now = activeEmoji(all.grid)?.id;
      if (now === previous) break;
      previous = now;
    }
    await userEvent.keyboard("{ArrowRight>9/}");
    // The last emoji of emojibase-data 18.0.0 is the flag of Wales.
    const last = activeEmoji(all.grid);
    await expect(last).toHaveAccessibleName("flag: Wales");
    await userEvent.keyboard("{Enter}");
    await expect(answers).toHaveBeenLastCalledWith(last!.textContent);
    await expectStrict();
  },
};

export const ASwitchOfTheTabLeavesTheFocusOnTheTab: Story = {
  render: () => <Form answer={answers} stored="🏠" />,
  play: async () => {
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const { dialog, picker } = await opened();
    // A stored emoji opens on "Emoji", with the focus in its search.
    const first = await emojiTab(dialog);
    await waitFor(() => expect(first.search).toHaveFocus());
    // Back to the tabs, over to "Icons" and back: the Emoji tab mounts anew, and its search does
    // not take the focus a second time, so the arrows go on switching the tab.
    await userEvent.tab({ shift: true });
    await expect(picker.getByRole("tab", { name: "Emoji" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(picker.getByRole("tab", { name: "Icons", selected: true })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await emojiTab(dialog);
    await expect(picker.getByRole("tab", { name: "Emoji", selected: true })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(picker.getByRole("tab", { name: "Icons", selected: true })).toHaveFocus();
  },
};

export const NamesEveryControl: Story = {
  render: () => <Form answer={answers} stored="🏠" />,
  play: async ({ canvas }) => {
    await userEvent.click(trigger(canvas));
    const { dialog, picker } = await opened();
    await emojiTab(dialog);
    await userEvent.click(picker.getByRole("button", { name: "Skin tone" }));
    await picker.findByRole("button", { name: "Dark skin tone" });
    const controls = ["button", "tab", "searchbox", "grid", "gridcell", "tabpanel"].flatMap(
      (role) => picker.queryAllByRole(role),
    );
    await expect(controls.length).toBeGreaterThan(20);
    for (const control of controls) await expect(control).toHaveAccessibleName();
  },
};

export const AnUnknownStoredValueStaysUntilTheUserActs: Story = {
  render: () => (
    <Stack>
      {["a-picture-from-a-newer-version", "🦊‍🔥"].map((stored) => (
        <div data-testid={stored} key={stored}>
          <Form answer={answers} stored={stored} />
        </div>
      ))}
    </Stack>
  ),
  play: async ({ canvas }) => {
    answers.mockClear();
    // A name this version does not know shows as nothing chosen, on the Icons tab.
    const unknownName = within(canvas.getByTestId("a-picture-from-a-newer-version"));
    await expect(trigger(unknownName)).toHaveAccessibleName("Icon No icon");
    await userEvent.click(trigger(unknownName));
    const first = await opened();
    await expect(first.selectedTab()).toHaveAccessibleName("Icons");
    await expect(within(first.grid()).queryAllByRole("option", { selected: true })).toHaveLength(0);
    // Looking is not a choice: the stored value stays until the user acts.
    await userEvent.keyboard("{Escape}");
    await closed();
    await expect(unknownName.getByTestId("stored")).toHaveTextContent(
      "a-picture-from-a-newer-version",
    );

    // An emoji the list does not know shows on the button and opens on the Emoji tab.
    const unknownEmoji = within(canvas.getByTestId("🦊‍🔥"));
    await expect(trigger(unknownEmoji)).toHaveAccessibleName("Icon 🦊‍🔥");
    await userEvent.click(trigger(unknownEmoji));
    const second = await opened();
    await expect(second.selectedTab()).toHaveAccessibleName("Emoji");
    await emojiTab(second.dialog);
    await userEvent.keyboard("{Escape}");
    await closed();
    await expect(unknownEmoji.getByTestId("stored")).toHaveTextContent("🦊‍🔥");
    await expect(answers).not.toHaveBeenCalled();

    // Both can be cleared.
    for (const form of [unknownName, unknownEmoji]) {
      await userEvent.click(trigger(form));
      const { picker } = await opened();
      await userEvent.click(picker.getByRole("button", { name: "No icon" }));
      await expect(answers).toHaveBeenLastCalledWith(null);
      await expect(form.getByTestId("stored")).toHaveTextContent("nothing");
      await closed();
    }
  },
};

export const NothingStoredHasNothingToClear: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    answers.mockClear();
    await userEvent.click(trigger(canvas));
    const { picker } = await opened();
    await expect(picker.getByRole("button", { name: "No icon" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await closed();
    await expect(answers).not.toHaveBeenCalled();
  },
};

/** The name the render count gives the grid's pictures. */
const PICTURE = "PictureOption";

export const AMoveOfTheFocusRedrawsTwoPictures: Story = {
  render: () => <Form answer={answers} stored="house" />,
  play: async ({ canvas }) => {
    await userEvent.click(trigger(canvas));
    const { grid, search } = await opened();
    await waitFor(() => expect(search()).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    const chosen = within(grid()).getByRole("option", { name: "House" });
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
    await expect(within(dialog).getByRole("tab", { name: "Icons" })).toBeInTheDocument();
    await expect(within(dialog).getByRole("tab", { name: "Emoji" })).toBeInTheDocument();
    await expect(within(dialog).getByRole("button", { name: "Kein Icon" })).toBeInTheDocument();
    const search = within(dialog).getByRole("searchbox", { name: "Icons durchsuchen" });
    await userEvent.type(search, "gluhbirne");
    const grid = within(dialog).getByRole("listbox", { name: "Icons" });
    await expect(shownOptions(grid)).toEqual(["Glühbirne"]);
  },
};

/** Where an element is on the screen, as a plain value to compare. */
function boxOf(element: Element) {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
}

/** The open dialog, whatever the language names it. */
const dialogShown = () => screen.findByRole("dialog");

/** The search field of the tab shown: each tab has its own, and only one is in the dialog. */
const searchShown = (dialog: HTMLElement) => within(dialog).getByRole("searchbox");

/** The tab of that name, in English or German: both languages call them "Icons" and "Emoji". */
const tabNamed = (dialog: HTMLElement, name: "Icons" | "Emoji") =>
  within(dialog).getByRole("tab", { name });

async function typeIn(field: HTMLElement, term: string) {
  await userEvent.clear(field);
  if (term !== "") await userEvent.type(field, term);
}

/** The play of the size stories: the dialog's box, compared after every change in the dialog. */
async function keepsOneSize(canvas: ReturnType<typeof within>) {
  await userEvent.click(trigger(canvas));
  const dialog = await dialogShown();
  const size = boxOf(dialog);
  const expectSameSize = () => waitFor(() => expect(boxOf(dialog)).toEqual(size));

  // The Icons tab: a search with a few matches and one with none.
  for (const term of ["bank", "no picture is called this", ""]) {
    await typeIn(searchShown(dialog), term);
    await expectSameSize();
  }
  // The Emoji tab, with its grid, a few matches and none.
  await userEvent.click(tabNamed(dialog, "Emoji"));
  await within(dialog).findByRole("grid", {}, { timeout: 10_000 });
  await expectSameSize();
  for (const term of ["house", "no emoji is called this", ""]) {
    await typeIn(searchShown(dialog), term);
    await expectSameSize();
  }
  // And back.
  await userEvent.click(tabNamed(dialog, "Icons"));
  await expectSameSize();
}

export const KeepsOneSizeOnBothTabs: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    await keepsOneSize(canvas);
  },
};

export const KeepsOneSizeAtTheLargestFontScale: Story = {
  ...KeepsOneSizeOnBothTabs,
  globals: { fontScale: "112.5" },
};

export const KeepsOneSizeInTheCompactDensity: Story = {
  ...KeepsOneSizeOnBothTabs,
  globals: { density: "compact" },
};

/** The box inside an element's border. */
function insideTheBorder(element: Element) {
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const left = box.left + Number.parseFloat(style.borderLeftWidth);
  const right = box.right - Number.parseFloat(style.borderRightWidth);
  return { left, right };
}

/** The play of the placement stories: both tabs line up, and the emoji picker fits inside. */
async function linesUpBothTabs(canvas: ReturnType<typeof within>) {
  await userEvent.click(trigger(canvas));
  const dialog = await dialogShown();
  const tabList = boxOf(within(dialog).getByRole("tablist"));
  const clear = within(dialog).getAllByRole("button").at(-1)!;
  const clearBox = boxOf(clear);
  const iconSearch = searchShown(dialog).getBoundingClientRect();
  // The grid fills the width of the search field above it.
  const iconGrid = within(dialog)
    .getByRole("listbox")
    .closest(".mantine-ScrollArea-viewport")!
    .getBoundingClientRect();
  await expect([iconGrid.left, iconGrid.right]).toEqual([iconSearch.left, iconSearch.right]);

  await userEvent.click(tabNamed(dialog, "Emoji"));
  const grid = await within(dialog).findByRole("grid", {}, { timeout: 10_000 });
  const search = searchShown(dialog);
  // The picker lies inside the dialog's border and brings no frame of its own.
  const picker = search.closest(".mantine-EmojiPicker-root")!;
  const room = insideTheBorder(dialog);
  const pickerBox = picker.getBoundingClientRect();
  await expect(pickerBox.left).toBeGreaterThanOrEqual(room.left);
  await expect(pickerBox.right).toBeLessThanOrEqual(room.right);
  await expect(getComputedStyle(picker).borderTopWidth).toBe("0px");
  await expect(getComputedStyle(picker).borderLeftWidth).toBe("0px");
  // Its search field and its grid have the inset of the Icons tab's, on the left and the right,
  // and the search field is where the Icons tab has its own.
  const emojiSearch = search.getBoundingClientRect();
  await expect([emojiSearch.left, emojiSearch.top, emojiSearch.right, emojiSearch.height]).toEqual([
    iconSearch.left,
    iconSearch.top,
    iconSearch.right,
    iconSearch.height,
  ]);
  const emojiGrid = grid.getBoundingClientRect();
  await expect([emojiGrid.left, emojiGrid.right]).toEqual([iconSearch.left, iconSearch.right]);
  // The tabs and "No icon" stay where they were.
  await expect(boxOf(within(dialog).getByRole("tablist"))).toEqual(tabList);
  await expect(boxOf(within(dialog).getAllByRole("button").at(-1)!)).toEqual(clearBox);
}

export const LinesUpBothTabs: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    await linesUpBothTabs(canvas);
  },
};

export const LinesUpBothTabsAtTheLargestFontScale: Story = {
  ...LinesUpBothTabs,
  globals: { fontScale: "112.5" },
};

export const LinesUpBothTabsInTheCompactDensity: Story = {
  ...LinesUpBothTabs,
  globals: { density: "compact" },
};

export const LinesUpBothTabsInGerman: Story = {
  ...LinesUpBothTabs,
  globals: { language: "de" },
};

const SCROLL_ROUNDING = 0.5;

/**
 * Asserts that the focus ring of the focused picture shows whole: inside the grid's scroll
 * viewport, which cuts what reaches past it, and clear of the scrollbar, which lies over it.
 */
async function expectWholeRing(option: HTMLElement) {
  await expect(option).toHaveFocus();
  const style = getComputedStyle(option);
  await expect(style.outlineStyle).toBe("solid");
  // An outline reaches past the border box by its offset and its width.
  const reach = Number.parseFloat(style.outlineOffset) + Number.parseFloat(style.outlineWidth);
  const cell = option.getBoundingClientRect();
  const ring = {
    left: cell.left - reach,
    top: cell.top - reach,
    right: cell.right + reach,
    bottom: cell.bottom + reach,
  };
  const scrollArea = option.closest(".mantine-ScrollArea-root")!;
  const viewport = scrollArea
    .querySelector(".mantine-ScrollArea-viewport")!
    .getBoundingClientRect();
  // Pictures are a fraction of a pixel high and the viewport scrolls by whole pixels, so at the
  // end of the scroll up to half a pixel of the last row may stay out of view.
  await expect(ring.left).toBeGreaterThanOrEqual(viewport.left);
  await expect(ring.top).toBeGreaterThanOrEqual(viewport.top - SCROLL_ROUNDING);
  await expect(ring.right).toBeLessThanOrEqual(viewport.right);
  await expect(ring.bottom).toBeLessThanOrEqual(viewport.bottom + SCROLL_ROUNDING);
  const scrollbar = scrollArea.querySelector(
    '.mantine-ScrollArea-scrollbar[data-orientation="vertical"]',
  );
  // Mantine places the scrollbar once it has measured the content.
  if (scrollbar !== null)
    await waitFor(() =>
      expect(ring.right).toBeLessThanOrEqual(scrollbar.getBoundingClientRect().left),
    );
}

export const ShowsTheWholeFocusRingOnEveryEdgeOfTheGrid: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    await userEvent.click(trigger(canvas));
    const { grid, search } = await opened();
    await waitFor(() => expect(search()).toHaveFocus());
    const options = within(grid()).getAllByRole("option");
    const columns = options.filter((option) => option.offsetTop === options[0]!.offsetTop).length;
    const lastRow = Math.floor((options.length - 1) / columns) * columns;
    // The first picture, then the last of the first row.
    await userEvent.keyboard("{ArrowDown}");
    await expectWholeRing(options[0]!);
    await userEvent.keyboard(`{ArrowRight>${columns - 1}/}`);
    await expectWholeRing(options[columns - 1]!);
    // The last picture, scrolled into view, and the first of the last row.
    await userEvent.keyboard("{End}");
    await expectWholeRing(options.at(-1)!);
    await userEvent.keyboard(`{ArrowLeft>${options.length - 1 - lastRow}/}`);
    await expectWholeRing(options[lastRow]!);
    // The last of the row above the last, whose ring meets the scrollbar's side.
    await userEvent.keyboard("{ArrowLeft}");
    await expectWholeRing(options[lastRow - 1]!);
    // And the first again, scrolled back up.
    await userEvent.keyboard("{Home}");
    await expectWholeRing(options[0]!);
  },
};

export const ShowsTheWholeFocusRingAtTheLargestFontScale: Story = {
  ...ShowsTheWholeFocusRingOnEveryEdgeOfTheGrid,
  globals: { fontScale: "112.5" },
};

export const ShowsTheWholeFocusRingInTheCompactDensity: Story = {
  ...ShowsTheWholeFocusRingOnEveryEdgeOfTheGrid,
  globals: { density: "compact" },
};

/** Mantine's glyph size of its emoji picker's size `sm`, at the 100 % font scale. */
const EMOJI_GLYPH_SIZE = 18;

/**
 * The play of the row stories: in the emoji grid the buttons of one row end where the buttons of
 * the next begin, so the hover and focus background of an emoji stays in its own row and leaves
 * no gap to the next, and the glyphs keep Mantine's size at every font scale.
 */
async function keepsTheEmojiRowsApart(canvas: ReturnType<typeof within>) {
  await userEvent.click(trigger(canvas));
  const dialog = await dialogShown();
  await userEvent.click(tabNamed(dialog, "Emoji"));
  const grid = await within(dialog).findByRole("grid", {}, { timeout: 10_000 });
  // The rows the virtual list shows, in order; a category's label is a row of its own.
  const rows = within(grid)
    .getAllByRole("row")
    .map((row) => within(row).queryAllByRole("gridcell"));
  let pairs = 0;
  for (const [index, upper] of rows.entries()) {
    const lower = rows[index + 1];
    if (upper.length === 0 || lower === undefined || lower.length === 0) continue;
    const bottom = Math.max(...upper.map((cell) => cell.getBoundingClientRect().bottom));
    const top = Math.min(...lower.map((cell) => cell.getBoundingClientRect().top));
    await expect(Math.abs(top - bottom)).toBeLessThanOrEqual(SCROLL_ROUNDING);
    pairs += 1;
  }
  await expect(pairs).toBeGreaterThan(3);
  const scale = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--mantine-scale"),
  );
  const cell = within(grid).getAllByRole("gridcell")[0]!;
  await expect(Number.parseFloat(getComputedStyle(cell).fontSize)).toBeCloseTo(
    EMOJI_GLYPH_SIZE * scale,
  );
}

export const KeepsTheEmojiRowsApart: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    await keepsTheEmojiRowsApart(canvas);
  },
};

export const KeepsTheEmojiRowsApartAtTheLargestFontScale: Story = {
  ...KeepsTheEmojiRowsApart,
  globals: { fontScale: "112.5" },
};

export const KeepsTheEmojiRowsApartAtTheSmallestFontScale: Story = {
  ...KeepsTheEmojiRowsApart,
  globals: { fontScale: "87.5" },
};

export const KeepsTheEmojiRowsApartInTheCompactDensity: Story = {
  ...KeepsTheEmojiRowsApart,
  globals: { density: "compact" },
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
    await expect(search().getBoundingClientRect().height).toBe(COMPACT_CONTROL_HEIGHT);
    // A picture is at least as wide as a row of the Density is high, and square.
    const row = canvas.getByTestId("row").getBoundingClientRect().height;
    const cell = within(grid()).getByRole("option", { name: "House" }).getBoundingClientRect();
    await expect(cell.width).toBeGreaterThanOrEqual(row);
    await expect(Math.round(cell.height)).toBe(Math.round(cell.width));
  },
};
