// Fields bound through `useFieldBinding` (D319): a violation at a picker, a value set by code, and
// text that is no value. The form here submits to a Contract of its own, stricter than the
// example's: the icon and the color must be chosen, and the hours are a number that the story's
// own field reads from typed text, as the date and time fields of `time-tracking` will.

import { Button, Stack, TextInput } from "@mantine/core";
import { oc } from "@orpc/contract";
import { DataProvider, portHooks } from "@self-engine/data-client/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { memo, useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { z } from "zod";
import {
  ColorField,
  IconField,
  type OperationForm,
  TextField,
  useFieldBinding,
  useOperationForm,
} from "../../index.ts";
import { type RecordingPort, recordingPortOf } from "./story-port.ts";

const markedFields = {
  title: z.string().trim().min(1).max(80),
  icon: z.string(),
  color: z.string(),
  hours: z.number().min(0).nullable(),
};

const markedEntrySchema = z.object({ id: z.string(), ...markedFields });

const markedContract = {
  create: oc.input(z.strictObject(markedFields)).output(markedEntrySchema),
  update: oc.input(markedEntrySchema.partial().required({ id: true })).output(markedEntrySchema),
};

const markedHooks = portHooks<typeof markedContract>("marked");
const useCreateMarked = markedHooks.operation("create");
const useUpdateMarked = markedHooks.operation("update");

/** A form of either Operation: the edit's draft may hold no hours, as its input may leave them out. */
type MarkedForm = OperationForm<{ hours: number | null | undefined }>;

/** The text the hours field shows for a value of the draft. */
const hoursText = (hours: number | null | undefined) =>
  typeof hours === "number" ? String(hours) : "";

/** The number a typed text stands for: `null` for none, `undefined` while it is no number. */
function hoursOf(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : undefined;
}

/**
 * A number typed as text: it keeps what is typed, hands on only a number or "empty", and reports
 * any other text as unfinished. A value from outside, set by code or followed from the stored
 * entry, replaces its text, also one equal to the value the text stood for.
 */
const HoursField = memo(function HoursField({ form }: { readonly form: MarkedForm }) {
  const field = useFieldBinding(form, "hours");
  const [text, setText] = useState(() => hoursText(field.value));
  const [seen, setSeen] = useState(field.setFromOutside);
  if (field.setFromOutside !== seen) {
    setSeen(field.setFromOutside);
    setText(hoursText(field.value));
  }
  return (
    <TextInput
      error={field.error}
      label="Hours"
      onBlur={field.onBlur}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setText(next);
        const hours = hoursOf(next);
        if (hours === undefined) {
          field.onUnfinished();
          return;
        }
        field.onChange(hours);
      }}
      ref={field.ref}
      value={text}
    />
  );
});

const SUGGESTED = { title: "Launch", icon: "rocket-launch", color: "teal", hours: 8 } as const;
const STORED = { id: "marked-1", ...SUGGESTED };

/** Creates a marked entry; "Suggest" fills every field by code. */
function MarkedEntryForm() {
  const form = useOperationForm({
    entry: markedContract.create,
    operation: useCreateMarked(),
    draft: { title: "", icon: null, color: null, hours: null },
  });
  return (
    <Stack>
      <TextField form={form} label="Title" name="title" />
      <IconField form={form} label="Icon" name="icon" />
      <ColorField form={form} label="Color" name="color" />
      <HoursField form={form} />
      <Button
        onClick={() => {
          for (const [field, value] of Object.entries(SUGGESTED)) {
            form.setValue(field as keyof typeof SUGGESTED, value);
          }
        }}
        variant="default"
      >
        Suggest
      </Button>
      <Button onClick={() => void form.submit()}>Save</Button>
    </Stack>
  );
}

/**
 * Edits a marked entry. The module gives the stored entry on every draw (D324); "Change
 * elsewhere" changes it under the open form, as another window would.
 */
function MarkedEditForm() {
  const [stored, setStored] = useState<z.output<typeof markedEntrySchema>>(STORED);
  const form = useOperationForm({
    entry: markedContract.update,
    operation: useUpdateMarked(),
    draft: stored,
    edit: { identity: { id: stored.id } },
  });
  return (
    <Stack>
      <TextField form={form} label="Title" name="title" />
      <HoursField form={form} />
      <Button
        onClick={() => setStored((entry) => ({ ...entry, title: "Launch day", hours: 9 }))}
        variant="default"
      >
        Change elsewhere
      </Button>
      <Button onClick={() => void form.submit()}>Save</Button>
    </Stack>
  );
}

interface Loaded {
  readonly port: RecordingPort;
}

const meta = {
  title: "Forms/Bound fields",
  loaders: [
    (): Loaded => ({
      port: recordingPortOf(
        { marked: markedContract },
        { marked: { create: { data: STORED }, update: { data: STORED } } },
      ),
    }),
  ],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access}>
      <MarkedEntryForm />
    </DataProvider>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const callsOf = (loaded: unknown) => (loaded as Loaded).port.calls;

/** The fields and the buttons, found as a user finds them. */
function formIn(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const color = () => canvas.getByRole("radiogroup", { name: "Color" });
  return {
    title: () => canvas.getByRole("textbox", { name: "Title" }),
    icon: () => canvas.getByRole("button", { name: /^Icon/ }),
    color,
    colorChoice: (name: string) => within(color()).getByRole("radio", { name }),
    hours: () => canvas.getByRole("textbox", { name: "Hours" }),
    suggest: () => userEvent.click(canvas.getByRole("button", { name: "Suggest" })),
    changeElsewhere: () =>
      userEvent.click(canvas.getByRole("button", { name: "Change elsewhere" })),
    save: () => userEvent.click(canvas.getByRole("button", { name: "Save" })),
  };
}

const REQUIRED = "This field is required.";
const UNFINISHED = "Complete or clear this field.";

async function chooseIcon(form: ReturnType<typeof formIn>, name: string) {
  await userEvent.click(form.icon());
  const dialog = await screen.findByRole("dialog", { name: "Choose an icon" });
  await userEvent.click(
    within(within(dialog).getByRole("listbox", { name: "Icons" })).getByRole("option", { name }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

export const AViolationAtAPickerShowsThereAndTakesTheFocus: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await userEvent.type(form.title(), "Kitchen");
    await form.save();
    // Each message is linked to its picker, and the first one on screen takes the focus.
    await expect(form.icon()).toHaveAccessibleDescription(REQUIRED);
    await expect(form.color()).toHaveAccessibleDescription(REQUIRED);
    await expect(form.color()).toHaveAttribute("aria-invalid", "true");
    await expect(form.icon()).toHaveFocus();
    await expect(callsOf(loaded)).toEqual([]);

    // Choosing removes the message at once; the next save focuses the color, which is left.
    await chooseIcon(form, "House");
    await expect(form.icon()).not.toHaveAccessibleDescription(REQUIRED);
    await form.save();
    await expect(form.colorChoice("No color")).toHaveFocus();
    await expect(callsOf(loaded)).toEqual([]);

    await userEvent.click(form.colorChoice("Teal"));
    await expect(form.color()).not.toHaveAccessibleDescription(REQUIRED);
    await expect(form.color()).not.toHaveAttribute("aria-invalid");
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        {
          entry: "create",
          input: { title: "Kitchen", icon: "house", color: "teal", hours: null },
        },
      ]),
    );
  },
};

export const AValueSetByCodeShowsInEveryField: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await form.save();
    await expect(form.icon()).toHaveAccessibleDescription(REQUIRED);

    await form.suggest();
    await expect(form.title()).toHaveValue("Launch");
    await expect(form.icon()).toHaveAccessibleName("Icon Rocket");
    await expect(form.colorChoice("Teal")).toBeChecked();
    await expect(form.hours()).toHaveValue("8");
    // The values are checked as any change after a failed save: every message is gone.
    await expect(form.icon()).not.toHaveAccessibleDescription(REQUIRED);
    await expect(form.color()).not.toHaveAccessibleDescription(REQUIRED);
    await form.save();
    await waitFor(() => expect(callsOf(loaded)).toEqual([{ entry: "create", input: SUGGESTED }]));
  },
};

export const TextThatIsNoValueBlocksTheSave: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await form.suggest();
    await userEvent.clear(form.hours());
    await userEvent.type(form.hours(), "12");
    // A letter makes the text no number. While the user types, nothing is reported.
    await userEvent.type(form.hours(), "x");
    await expect(form.hours()).not.toHaveAccessibleDescription(UNFINISHED);
    await userEvent.tab();
    await expect(form.hours()).toHaveAccessibleDescription(UNFINISHED);
    await expect(form.hours()).toHaveValue("12x");

    // "Save" calls no Operation, so the older 12 is never saved in the text's place.
    await form.save();
    await expect(form.hours()).toHaveFocus();
    await expect(callsOf(loaded)).toEqual([]);

    // Finishing the value removes the message at once.
    await userEvent.type(form.hours(), "{Backspace}");
    await expect(form.hours()).not.toHaveAccessibleDescription(UNFINISHED);
    await expect(form.hours()).not.toHaveAttribute("aria-invalid", "true");
    await userEvent.type(form.hours(), "5");
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([{ entry: "create", input: { ...SUGGESTED, hours: 125 } }]),
    );
  },
};

export const SavingWithTextThatIsNoValueShowsItsMessage: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await form.suggest();
    await userEvent.clear(form.hours());
    await userEvent.type(form.hours(), "two");
    // "Save" straight from the field reports the text, though it was never left before.
    await form.save();
    await expect(form.hours()).toHaveAccessibleDescription(UNFINISHED);
    await expect(form.hours()).toHaveFocus();
    await expect(callsOf(loaded)).toEqual([]);

    // A value set by code replaces the text and its message.
    await form.suggest();
    await expect(form.hours()).toHaveValue("8");
    await expect(form.hours()).not.toHaveAccessibleDescription(UNFINISHED);
    // Clearing the text hands on "empty", which is a value.
    await userEvent.clear(form.hours());
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([{ entry: "create", input: { ...SUGGESTED, hours: null } }]),
    );
  },
};

export const ValueSetByCodeAgainReplacesTextThatIsNoValue: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await form.suggest();
    await userEvent.type(form.hours(), "x");
    await expect(form.hours()).toHaveValue("8x");
    // The same value again, which the draft holds already: the field shows it, not the old text.
    await form.suggest();
    await expect(form.hours()).toHaveValue("8");
    await form.save();
    await expect(form.hours()).not.toHaveAccessibleDescription(UNFINISHED);
    await waitFor(() => expect(callsOf(loaded)).toEqual([{ entry: "create", input: SUGGESTED }]));
  },
};

const editRender: Story["render"] = (_args, { loaded }) => (
  <DataProvider access={(loaded as Loaded).port.access}>
    <MarkedEditForm />
  </DataProvider>
);

interface Held extends Loaded {
  /** Lets the answers through that waited. */
  readonly release: () => void;
}

/** A Port whose answers wait until the story lets them through, so it can act while a save runs. */
function heldPort(): Held {
  const port = recordingPortOf(
    { marked: markedContract },
    { marked: { create: { data: STORED }, update: { data: STORED } } },
  );
  const held = Promise.withResolvers<void>();
  return {
    release: held.resolve,
    port: {
      calls: port.calls,
      access: {
        ...port.access,
        async call(module, entry, input, signal) {
          const answer = port.access.call(module, entry, input, signal);
          await held.promise;
          return answer;
        },
      },
    },
  };
}

export const AValueChangedWhileASaveRunsStaysChanged: Story = {
  loaders: [heldPort],
  render: editRender,
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await userEvent.type(form.title(), " day");
    await form.save();
    await waitFor(() => expect(callsOf(loaded)).toHaveLength(1));
    // The save is on its way without these hours: its success must not count them as saved.
    await userEvent.clear(form.hours());
    await userEvent.type(form.hours(), "5");
    (loaded as Held).release();
    await waitFor(async () => {
      await form.save();
      await expect(callsOf(loaded)).toHaveLength(2);
    });
    await expect(callsOf(loaded)).toEqual([
      { entry: "update", input: { id: STORED.id, title: "Launch day" } },
      { entry: "update", input: { id: STORED.id, hours: 5 } },
    ]);
  },
};

export const AnUntouchedNumberFieldFollowsTheEntry: Story = {
  render: editRender,
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await expect(form.hours()).toHaveValue("8");
    await form.changeElsewhere();
    await expect(form.title()).toHaveValue("Launch day");
    await expect(form.hours()).toHaveValue("9");
    await form.save();
    await expect(callsOf(loaded)).toEqual([]);
  },
};

export const TextThatIsNoValueStaysWhenTheEntryChanges: Story = {
  render: editRender,
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await userEvent.type(form.hours(), "x");
    await form.changeElsewhere();
    // The untouched title follows; the half-typed text neither vanishes nor gives way to 9.
    await expect(form.title()).toHaveValue("Launch day");
    await expect(form.hours()).toHaveValue("8x");
    // "Save" sends neither the older 8 nor the stored 9 in the text's place.
    await form.save();
    await expect(form.hours()).toHaveAccessibleDescription(UNFINISHED);
    await expect(form.hours()).toHaveFocus();
    await expect(callsOf(loaded)).toEqual([]);

    // Finished, the text is a change against the stored 9 and is sent.
    await userEvent.type(form.hours(), "{Backspace}");
    await expect(form.hours()).not.toHaveAccessibleDescription(UNFINISHED);
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([{ entry: "update", input: { id: "marked-1", hours: 8 } }]),
    );
  },
};
