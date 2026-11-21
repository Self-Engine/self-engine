// An input error the Operation raises (D369): the example's create declares that it refuses a day
// after the Data Process's today, which the page cannot judge. The form shows the reason's text at
// the field the error names, as it shows a reason of its own check; an issue at a field the form
// does not show goes to the general notice.

import { msg } from "@lingui/core/macro";
import { Button, Stack } from "@mantine/core";
import { DataProvider } from "@self-engine/data-client/react";
import { calendarDaySchema } from "@self-engine/time";
import { clearNotices } from "@self-engine/ui/story-notices";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, spyOn, userEvent, waitFor, within } from "storybook/test";
import { CalendarDayField, TextField, useOperationForm } from "../../index.ts";
import { DAY_AFTER_TODAY, exampleContract } from "./contract.ts";
import { EXAMPLE_TODAY, ExampleForm } from "./example-form.tsx";
import { useCreateExample } from "./port.ts";
import { type RecordingPort, recordingPort } from "./story-port.ts";

interface Loaded {
  readonly port: RecordingPort;
  readonly created: () => void;
}

/** The example's Port, whose create raises an input error at the day. */
const loadInvalidDay = (): Loaded => ({
  port: recordingPort({ create: { invalid: [{ path: ["day"], reason: DAY_AFTER_TODAY }] } }),
  created: fn(),
});

const meta = {
  title: "Forms/Example form/Input error of the Operation",
  globals: { language: "en" },
  loaders: [loadInvalidDay],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access}>
      <ExampleForm onSuccess={(loaded as Loaded).created} />
    </DataProvider>
  ),
  // The notices live in Mantine's store, which outlives a story; they stay until the story ends.
  beforeEach: () => {
    clearNotices();
    return holdTimers(8000).restore;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function formIn(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  return {
    title: () => canvas.getByRole("textbox", { name: "Title" }),
    description: () => canvas.getByRole("textbox", { name: "Description" }),
    day: () => canvas.getByRole("textbox", { name: "Day" }),
    save: () => userEvent.click(canvas.getByRole("button", { name: /^(Save|Speichern)$/ })),
  };
}

/** Fills in a draft the page's own check accepts, a day included, and saves. */
async function fillInAndSave(form: ReturnType<typeof formIn>) {
  await userEvent.type(form.title(), "Kitchen");
  await userEvent.type(form.description(), "Paint the walls.");
  await userEvent.type(form.day(), "11/5/31");
  await userEvent.tab();
  await form.save();
}

const noticeOnScreen = () =>
  document.querySelector<HTMLElement>(".mantine-Notification-root") ?? undefined;

const AFTER_TODAY = "Choose today or an earlier day.";
/** A day after the example's today, which only the Data Process refuses. */
const AFTER_TODAY_DAY = calendarDaySchema.parse("2031-11-05");

export const TheReasonIsShownAtItsFieldWhichTakesTheFocus: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);

    await waitFor(() => expect(form.day()).toHaveAccessibleDescription(AFTER_TODAY));
    // The save failed: the draft stays, the form unlocks, and the field with the message has the
    // focus. No notice repeats it.
    await waitFor(() => expect(form.day()).toHaveFocus());
    await expect(form.title()).toBeEnabled();
    await expect(form.title()).toHaveValue("Kitchen");
    await expect(form.day()).toHaveValue("11/05/2031");
    await expect((loaded as Loaded).created).not.toHaveBeenCalled();
    await expect(noticeOnScreen()).toBeUndefined();
  },
};

export const ChangingTheFieldRemovesTheMessage: Story = {
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);
    await waitFor(() => expect(form.day()).toHaveAccessibleDescription(AFTER_TODAY));

    // A change elsewhere leaves it; a change to its field answers it.
    await userEvent.type(form.description(), " Twice.");
    await expect(form.day()).toHaveAccessibleDescription(AFTER_TODAY);
    await userEvent.clear(form.day());
    await userEvent.type(form.day(), "11/4/31");
    await userEvent.tab();
    await expect(form.day()).not.toHaveAccessibleDescription(AFTER_TODAY);
  },
};

export const TheReasonIsShownInGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await userEvent.type(form.title(), "Küche");
    await userEvent.type(form.description(), "Die Wände streichen.");
    await userEvent.type(form.day(), "5.11.2031");
    await userEvent.tab();
    await form.save();

    await waitFor(() =>
      expect(form.day()).toHaveAccessibleDescription("Wähle heute oder einen früheren Tag."),
    );
  },
};

/** A form of the example's create that shows only the title. */
function FormWithOnlyItsTitle({ created }: { readonly created: () => void }) {
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: {
      title: "Kitchen",
      description: "Paint the walls.",
      icon: null,
      color: null,
      day: AFTER_TODAY_DAY,
      start: null,
    },
    texts: { reasons: { [DAY_AFTER_TODAY]: msg`Choose today or an earlier day.` } },
    onSuccess: created,
  });
  return (
    <Stack>
      <TextField form={form} name="title" label="Title" />
      <Button onClick={() => void form.submit()}>Save</Button>
    </Stack>
  );
}

export const AnIssueAtAFieldTheFormDoesNotShowGoesToTheGeneralNotice: Story = {
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access}>
      <FormWithOnlyItsTitle created={(loaded as Loaded).created} />
    </DataProvider>
  ),
  play: async ({ canvasElement, loaded }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(noticeOnScreen()).toHaveTextContent(
        "Something went wrong, and the change was not saved.",
      ),
    );
    await expect((loaded as Loaded).created).not.toHaveBeenCalled();
  },
};

/** A form of the example's create whose texts leave out the reason, past the compiler. */
function FormWithoutTheReasonsText() {
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: {
      title: "Kitchen",
      description: "Paint the walls.",
      icon: null,
      color: null,
      day: AFTER_TODAY_DAY,
      start: null,
    },
    // @ts-expect-error -- the compiler asks for a text for each declared reason; this story shows
    // what a module that slips past it gets.
    texts: { reasons: {} },
  });
  return (
    <Stack>
      <TextField form={form} name="title" label="Title" />
      <CalendarDayField
        firstDayOfWeek="monday"
        form={form}
        label="Day"
        name="day"
        today={EXAMPLE_TODAY}
      />
      <Button onClick={() => void form.submit()}>Save</Button>
    </Stack>
  );
}

export const AReasonWithoutATextShowsTheCatchAllAndFailsTheStoryGate: Story = {
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access}>
      <FormWithoutTheReasonsText />
    </DataProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Only this deliberate failure consumes the error; ordinary stories fail on console.error.
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(canvas.getByRole("textbox", { name: "Day" })).toHaveAccessibleDescription(
          "Invalid value.",
        ),
      );
      await expect(reported).toHaveBeenCalledWith(
        `The Operation reports reason "${DAY_AFTER_TODAY}", but the form gives no text for it.`,
      );
    } finally {
      reported.mockRestore();
    }
  },
};
