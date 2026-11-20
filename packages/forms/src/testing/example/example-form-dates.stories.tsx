// The fields for a Calendar Day and a Wall-Clock Time on the example form (D319, D325): each is
// picked and typed, half-typed text blocks the save, and the pickers speak the App Language and
// start the week on the day handed in. "Today" is the day handed in too, never the device's.

import { Stack } from "@mantine/core";
import { DataProvider } from "@self-engine/data-client/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { ExampleForm } from "./example-form.tsx";
import { type RecordingPort, recordingPort } from "./story-port.ts";

interface Loaded {
  readonly port: RecordingPort;
}

const meta = {
  title: "Forms/Example form/Date and time",
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

const TEXTS = { title: "Kitchen", description: "Paint the walls.", icon: null, color: null };

function formIn(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  return {
    day: () => canvas.getByRole("textbox", { name: "Day" }),
    /** The hours of the time; the minutes follow it. */
    hours: () => canvas.getByRole("spinbutton", { name: "Start" }),
    minutes: () => canvas.getByRole("spinbutton", { name: /^(Minutes|Minuten)$/ }),
    amPm: () => canvas.getByRole("textbox", { name: "AM or PM" }),
    save: () => userEvent.click(canvas.getByRole("button", { name: "Save" })),
  };
}

async function typeTheTexts(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByRole("textbox", { name: "Title" }), "Kitchen");
  await userEvent.type(canvas.getByRole("textbox", { name: "Description" }), "Paint the walls.");
}

const UNFINISHED = "Complete or clear this field.";

export const ADayIsTypedAndPicked: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await typeTheTexts(canvasElement);
    await userEvent.type(form.day(), "11/5/26");
    // Left, a whole day reads as a picked one does.
    await userEvent.tab();
    await expect(form.day()).toHaveValue("11/05/2026");
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "create", input: { ...TEXTS, day: "2026-11-05", start: null } },
      ]),
    );

    // The calendar opens on the month of the day and names each day in full.
    await userEvent.click(form.day());
    await userEvent.click(
      await screen.findByRole("button", { name: "Thursday, November 12, 2026" }),
    );
    await expect(form.day()).toHaveValue("11/12/2026");
    await form.save();
    await waitFor(() => expect(callsOf(loaded)).toHaveLength(2));
    await expect(callsOf(loaded)[1]).toEqual({
      entry: "create",
      input: { ...TEXTS, day: "2026-11-12", start: null },
    });
  },
};

export const ATimeIsTypedAndPicked: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await typeTheTexts(canvasElement);
    await userEvent.click(form.hours());
    await userEvent.keyboard("0930");
    await expect(form.minutes()).toHaveValue("30");
    // Without AM or PM the time is not whole yet: no save.
    await form.save();
    await expect(callsOf(loaded)).toEqual([]);
    await userEvent.click(form.hours());
    await userEvent.click(await screen.findByRole("button", { name: "AM" }));
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "create", input: { ...TEXTS, day: null, start: "09:30" } },
      ]),
    );

    // The lists of the dropdown pick the hours and the minutes; English counts 12 hours.
    await userEvent.click(form.hours());
    await userEvent.click((await screen.findAllByRole("button", { name: "02" }))[0]!);
    await userEvent.click(screen.getByRole("button", { name: "45" }));
    await userEvent.click(screen.getByRole("button", { name: "PM" }));
    await form.save();
    await waitFor(() => expect(callsOf(loaded)).toHaveLength(2));
    await expect(callsOf(loaded)[1]).toEqual({
      entry: "create",
      input: { ...TEXTS, day: null, start: "14:45" },
    });
  },
};

export const HalfADayBlocksTheSave: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await typeTheTexts(canvasElement);
    await userEvent.type(form.day(), "31.02.2026");
    // Nothing shows while the field is being typed into.
    await expect(form.day()).toHaveAccessibleDescription("");
    await userEvent.tab();
    await expect(form.day()).toHaveAccessibleDescription(UNFINISHED);
    // Text that is no day stays as typed when the field is left.
    await expect(form.day()).toHaveValue("31.02.2026");
    await form.save();
    await expect(callsOf(loaded)).toEqual([]);

    await userEvent.clear(form.day());
    await userEvent.type(form.day(), "02/28/2026");
    await expect(form.day()).not.toHaveAttribute("aria-invalid", "true");
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "create", input: { ...TEXTS, day: "2026-02-28", start: null } },
      ]),
    );
  },
};

export const APickedDayReplacesHalfTypedText: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await typeTheTexts(canvasElement);
    await userEvent.type(form.day(), "11/5/2026");
    await userEvent.type(form.day(), "x");
    await expect(form.day()).toHaveValue("11/5/2026x");
    // The day picked is the one the field held before the text broke.
    await userEvent.click(
      await screen.findByRole("button", { name: "Thursday, November 5, 2026" }),
    );
    await expect(form.day()).toHaveValue("11/05/2026");
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "create", input: { ...TEXTS, day: "2026-11-05", start: null } },
      ]),
    );
  },
};

export const HoursWithoutMinutesBlockTheSave: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await typeTheTexts(canvasElement);
    await userEvent.click(form.hours());
    await userEvent.keyboard("09");
    await userEvent.click(canvasElement.querySelector("textarea")!);
    // Every input of the time reads the message, not only the hours.
    for (const input of [form.hours(), form.minutes(), form.amPm()]) {
      await expect(input).toHaveAccessibleDescription(UNFINISHED);
      await expect(input).toHaveAttribute("aria-invalid", "true");
    }
    await form.save();
    await expect(callsOf(loaded)).toEqual([]);

    await userEvent.click(form.minutes());
    await userEvent.keyboard("15");
    await userEvent.click(screen.getByRole("button", { name: "AM" }));
    await waitFor(() => expect(form.hours()).not.toHaveAccessibleDescription(UNFINISHED));
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "create", input: { ...TEXTS, day: null, start: "09:15" } },
      ]),
    );
  },
};

export const EmptiedFieldsHandOnEmpty: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await typeTheTexts(canvasElement);
    await userEvent.type(form.day(), "11/5/2026");
    await userEvent.clear(form.day());
    await userEvent.click(form.hours());
    await userEvent.keyboard("0930");
    await userEvent.click(screen.getByRole("button", { name: "AM" }));
    await userEvent.keyboard("{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}");
    await expect(form.hours()).toHaveValue("");
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "create", input: { ...TEXTS, day: null, start: null } },
      ]),
    );
  },
};

export const ThePickersSpeakGermanAndStartTheWeekOnMonday: Story = {
  globals: { language: "de" },
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await typeTheTexts(canvasElement);
    await userEvent.type(form.day(), "5.11.2026");
    const calendar = within(document.body);
    await expect(await calendar.findByText("November 2026")).toBeVisible();
    await expect(
      calendar.getByRole("button", { name: "Donnerstag, 5. November 2026" }),
    ).toBeVisible();
    // The week starts on the Monday handed in; the weekday names come from the language.
    const heads = calendar.getAllByRole("columnheader").map(({ textContent }) => textContent);
    await expect(heads).toEqual(["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]);

    // German counts 24 hours.
    await userEvent.click(form.hours());
    await userEvent.keyboard("1745");
    await expect(screen.queryByRole("button", { name: "PM" })).toBeNull();
    await form.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "create", input: { ...TEXTS, day: "2026-11-05", start: "17:45" } },
      ]),
    );
  },
};

export const AnEmptyDayOpensOnTheTodayHandedIn: Story = {
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await userEvent.click(form.day());
    const calendar = within(document.body);
    // The example hands in 14 February 2031: far from the device's clock, which marks no day here.
    await waitFor(() => expect(calendar.getByText("February 2031")).toBeVisible());
    const today = calendar.getByRole("button", { name: "Friday, February 14, 2031" });
    await expect(today).toHaveAttribute("data-today", "true");
    await expect(document.body.querySelectorAll("[data-today]")).toHaveLength(1);
  },
};
