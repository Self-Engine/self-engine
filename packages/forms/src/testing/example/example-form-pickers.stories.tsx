// The pickers of `ui` as fields of the example form (D319, D326): the field for icon and emoji and
// the color. Each story drives them as a user does, with the mouse or the keyboard, and asserts
// what the fields show and which call reached the Port.

import { Stack } from "@mantine/core";
import { DataProvider } from "@self-engine/data-client/react";
import {
  afterTheCommitsNowDue,
  difference,
  renderCounts,
} from "@self-engine/ui/story-render-counts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { ExampleForm } from "./example-form.tsx";
import { type RecordingPort, recordingPort } from "./story-port.ts";

interface Loaded {
  readonly port: RecordingPort;
}

const meta = {
  title: "Forms/Example form/Pickers",
  // A new Port for every render, so that a second run starts without calls.
  loaders: [(): Loaded => ({ port: recordingPort() })],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access}>
      <Stack>
        <ExampleForm onSuccess={() => undefined} />
      </Stack>
    </DataProvider>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const callsOf = (loaded: unknown) => (loaded as Loaded).port.calls;

/** The fields and the button, found as a user finds them. */
function formIn(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  return {
    title: () => canvas.getByRole("textbox", { name: "Title" }),
    description: () => canvas.getByRole("textbox", { name: "Description" }),
    /** The icon field's button, named by its label and what it shows. */
    icon: () => canvas.getByRole("button", { name: /^Icon/ }),
    color: () => canvas.getByRole("radiogroup", { name: "Color" }),
    colorChoice: (name: string) =>
      within(canvas.getByRole("radiogroup", { name: "Color" })).getByRole("radio", { name }),
    saveButton: () => canvas.getByRole("button", { name: "Save" }),
    save: () => userEvent.click(canvas.getByRole("button", { name: "Save" })),
  };
}

/** Fills in the two texts, so that the schema accepts the draft. */
async function typeTheTexts(form: ReturnType<typeof formIn>) {
  await userEvent.type(form.title(), "Kitchen");
  await userEvent.type(form.description(), "Paint the walls.");
}

/** The icon field's open dialog. */
async function iconDialog() {
  const dialog = await screen.findByRole("dialog", { name: "Choose an icon" });
  return { dialog, picker: within(dialog) };
}

const dialogClosed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

async function chooseIcon(form: ReturnType<typeof formIn>, name: string) {
  await userEvent.click(form.icon());
  const { picker } = await iconDialog();
  await userEvent.click(
    within(picker.getByRole("listbox", { name: "Icons" })).getByRole("option", { name }),
  );
  await dialogClosed();
}

async function chooseEmoji(form: ReturnType<typeof formIn>, name: string) {
  await userEvent.click(form.icon());
  const { dialog, picker } = await iconDialog();
  await userEvent.click(picker.getByRole("tab", { name: "Emoji" }));
  const grid = await within(dialog).findByRole("grid", { name: "Emojis" }, { timeout: 10_000 });
  await userEvent.click(within(grid).getByRole("gridcell", { name }));
  await dialogClosed();
}

async function clearIcon(form: ReturnType<typeof formIn>) {
  await userEvent.click(form.icon());
  const { picker } = await iconDialog();
  await userEvent.click(picker.getByRole("button", { name: "No icon" }));
  await dialogClosed();
}

const TEXTS = { title: "Kitchen", description: "Paint the walls." } as const;

export const TheOperationReceivesTheChosenIconEmojiAndColor: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await typeTheTexts(form);
    await chooseIcon(form, "Rocket");
    await expect(form.icon()).toHaveAccessibleName("Icon Rocket");
    await userEvent.click(form.colorChoice("Teal"));
    await expect(form.colorChoice("Teal")).toBeChecked();
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "create", input: { ...TEXTS, icon: "rocket-launch", color: "teal" } },
      ]),
    );

    // An emoji takes the icon's place in the same field.
    await chooseEmoji(form, "grinning face");
    await expect(form.icon()).toHaveAccessibleName("Icon 😀");
    await form.save();
    await waitFor(() => expect(callsOf(loaded)).toHaveLength(2));
    await expect(callsOf(loaded)[1]).toEqual({
      entry: "create",
      input: { ...TEXTS, icon: "😀", color: "teal" },
    });
  },
};

export const ClearingTheIconAndTheColorHandsOnEmpty: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await typeTheTexts(form);
    await chooseIcon(form, "House");
    await userEvent.click(form.colorChoice("Red"));

    await clearIcon(form);
    await expect(form.icon()).toHaveAccessibleName("Icon No icon");
    await userEvent.click(form.colorChoice("No color"));
    await expect(form.colorChoice("No color")).toBeChecked();
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "create", input: { ...TEXTS, icon: null, color: null } },
      ]),
    );
  },
};

export const EveryFieldIsReachedAndChosenWithTheKeyboard: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    // The Tab order is the order on screen; each picker is one Tab stop, named by its label.
    await userEvent.tab();
    await expect(form.title()).toHaveFocus();
    await userEvent.keyboard("Kitchen");
    await userEvent.tab();
    await expect(form.description()).toHaveFocus();
    await userEvent.keyboard("Paint the walls.");
    await userEvent.tab();
    await expect(form.icon()).toHaveFocus();
    await expect(form.icon()).toHaveAccessibleName("Icon No icon");

    await userEvent.keyboard("{Enter}");
    const { picker } = await iconDialog();
    await waitFor(() =>
      expect(picker.getByRole("searchbox", { name: "Search icons" })).toHaveFocus(),
    );
    await userEvent.keyboard("rocket{ArrowDown}{Enter}");
    await dialogClosed();
    await waitFor(() => expect(form.icon()).toHaveFocus());
    await expect(form.icon()).toHaveAccessibleName("Icon Rocket");

    await userEvent.tab();
    await expect(form.colorChoice("No color")).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(form.colorChoice("Red")).toBeChecked();
    await userEvent.tab();
    await expect(form.saveButton()).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "create", input: { ...TEXTS, icon: "rocket-launch", color: "red" } },
      ]),
    );
  },
};

const FIELDS = ["TextField", "LongTextField", "IconField", "ColorField"] as const;

/** How often each field drew while `act` ran. */
async function fieldsDrawnDuring(act: () => Promise<void>): Promise<Record<string, number>> {
  await afterTheCommitsNowDue();
  const before = renderCounts();
  await act();
  await afterTheCommitsNowDue();
  const drawn = difference(renderCounts(), before).components;
  return Object.fromEntries(FIELDS.map((name) => [name, drawn[name] ?? 0]));
}

export const ChoosingInOnePickerRedrawsNoOtherField: Story = {
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    // Only the field whose value changed draws, once; the texts and the other picker do not.
    await expect(await fieldsDrawnDuring(() => userEvent.click(form.colorChoice("Teal")))).toEqual({
      TextField: 0,
      LongTextField: 0,
      IconField: 0,
      ColorField: 1,
    });
    await expect(await fieldsDrawnDuring(() => chooseIcon(form, "Rocket"))).toEqual({
      TextField: 0,
      LongTextField: 0,
      IconField: 1,
      ColorField: 0,
    });
    // Typing redraws no picker.
    await expect(await fieldsDrawnDuring(() => userEvent.type(form.title(), "Kitchen"))).toEqual({
      TextField: 0,
      LongTextField: 0,
      IconField: 0,
      ColorField: 0,
    });

    // After a failed save every change is checked, and still only the chosen picker draws.
    await userEvent.clear(form.title());
    await form.save();
    await expect(await fieldsDrawnDuring(() => userEvent.click(form.colorChoice("Red")))).toEqual({
      TextField: 0,
      LongTextField: 0,
      IconField: 0,
      ColorField: 1,
    });
  },
};
