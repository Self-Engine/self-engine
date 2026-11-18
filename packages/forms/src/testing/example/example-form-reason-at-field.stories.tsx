// A refused save whose Reason names a column (D334, D337): the example's create hook maps the
// columns `title`, `description` and `color_set` to their fields, so such a Reason is shown at its
// field, and every other Reason in the shared Notice. The Reasons are the story's own, with their
// texts composed as the app composes them, and the frame's `target_deleted`.

import { useLingui } from "@lingui/react";
import { Button, Stack } from "@mantine/core";
import {
  DataProvider,
  type FrameReasons,
  type ReasonText,
  refusalTexts,
} from "@self-engine/data-client/react";
import { defineReason, type ReasonOf, referenced, targetDeleted } from "@self-engine/db/schema";
import { activateLanguage } from "@self-engine/i18n";
import { clearNotices } from "@self-engine/ui/story-notices";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { z } from "zod";
import { TextField, useOperationForm } from "../../index.ts";
import { exampleContract } from "./contract.ts";
import { ExampleForm } from "./example-form.tsx";
import { useCreateExample } from "./port.ts";
import { type RecordingPort, recordingPortOf } from "./story-port.ts";

/** A rule of the story: some titles are kept for the archive. */
const titleReserved = defineReason("title_reserved", z.object({ title: z.string() }));
/** A rule of the story without a field: the space holds no more entries. */
const spaceFull = defineReason("space_full", z.object({ limit: z.number() }));

type StoryReasons = FrameReasons | typeof titleReserved | typeof spaceFull;

const titleReservedText: ReasonText<typeof titleReserved> = ({ details }) =>
  `“${details.title}” is kept for the archive.`;
const spaceFullText: ReasonText<typeof spaceFull> = ({ details }) =>
  `This space holds no more than ${String(details.limit)} entries.`;

const texts = refusalTexts(
  [{ title_reserved: titleReservedText, space_full: spaceFullText }],
  () => undefined,
);

/** A Reason as a Fixed Answer gives it: the frame sets the severity. */
type StoryReason = Omit<ReasonOf<StoryReasons>, "severity">;

const TABLE = "example_entries";
const ROW = "example-1";
const RESERVED = {
  code: "title_reserved",
  table: TABLE,
  row: ROW,
  field: "title",
  details: { title: "Kitchen" },
} as const satisfies StoryReason;
const FULL = {
  code: "space_full",
  table: TABLE,
  row: ROW,
  details: { limit: 3 },
} as const satisfies StoryReason;
/** The frame's Reason at the column `color_set`: the chosen color set was deleted meanwhile. */
const COLOR_DELETED = {
  code: "target_deleted",
  table: TABLE,
  row: ROW,
  field: "color_set",
  details: { target: { table: "color_sets", id: "ocean" } },
} as const satisfies StoryReason;

interface Loaded {
  readonly port: RecordingPort;
  readonly created: () => void;
}

/** The example's Port, whose create is refused with these Reasons. */
const loadRefused =
  (...reasons: readonly [StoryReason, ...StoryReason[]]) =>
  (): Loaded => ({
    port: recordingPortOf(
      { example: exampleContract },
      { example: { create: { refused: reasons } } },
      { reasons: [referenced, targetDeleted, titleReserved, spaceFull] },
    ),
    created: fn(),
  });

function SwitchLanguage() {
  const { i18n } = useLingui();
  return <Button onClick={() => void activateLanguage(i18n, "de")}>Deutsch</Button>;
}

const meta = {
  title: "Forms/Example form/Reason at a field",
  globals: { language: "en" },
  loaders: [loadRefused(RESERVED)],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access} reasonTexts={texts}>
      <Stack>
        <SwitchLanguage />
        <ExampleForm onSuccess={(loaded as Loaded).created} />
      </Stack>
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

/** The fields and the button, found as a user finds them. */
function formIn(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  return {
    title: () => canvas.getByRole("textbox", { name: "Title" }),
    description: () => canvas.getByRole("textbox", { name: "Description" }),
    color: () => canvas.getByRole("radiogroup", { name: "Color" }),
    save: () => userEvent.click(canvas.getByRole("button", { name: "Save" })),
  };
}

/** Fills in the texts so that the Check accepts the draft, and saves. */
async function fillInAndSave(form: ReturnType<typeof formIn>) {
  await userEvent.type(form.title(), "Kitchen");
  await userEvent.type(form.description(), "Paint the walls.");
  await form.save();
}

/** The shared Notice of a Refusal on screen, if any. */
const noticeOnScreen = () =>
  document.querySelector<HTMLElement>(".mantine-Notification-root") ?? undefined;

/** The texts of the Reasons the shared Notice tells, once it is on screen: one, or a list. */
async function reasonsInTheNotice(): Promise<readonly (string | null)[]> {
  await waitFor(() => expect(noticeOnScreen()).toBeDefined());
  const notice = noticeOnScreen()!;
  const items = within(notice).queryAllByRole("listitem");
  if (items.length > 0) return items.map((item) => item.textContent);
  return [notice.querySelector(".mantine-Notification-description")?.textContent ?? null];
}

/** The refused save has ended: the form takes input again. */
const saveEnded = (form: ReturnType<typeof formIn>) =>
  waitFor(() => expect(form.title()).toBeEnabled());

export const AReasonAtAFieldIsShownThereAndTheDraftStays: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);

    await waitFor(() =>
      expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive."),
    );
    // What was typed stays, the form stays open, and no Notice repeats the Reason.
    await expect(form.title()).toHaveValue("Kitchen");
    await expect(form.description()).toHaveValue("Paint the walls.");
    await expect((loaded as Loaded).created).not.toHaveBeenCalled();
    await expect(noticeOnScreen()).toBeUndefined();
    await expect((loaded as Loaded).port.calls).toHaveLength(1);
  },
};

export const ChangingTheFieldRemovesTheMessage: Story = {
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);
    await waitFor(() =>
      expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive."),
    );

    // A change elsewhere leaves it; a change to its field answers it.
    await userEvent.type(form.description(), " Twice.");
    await expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive.");
    await userEvent.type(form.title(), " two");
    await expect(form.title()).not.toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );
  },
};

export const AReasonWithoutAFieldOrAtAColumnNotMappedGoesToTheNotice: Story = {
  loaders: [loadRefused(FULL, { ...RESERVED, field: "id" })],
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);

    await expect(await reasonsInTheNotice()).toEqual([
      "This space holds no more than 3 entries.",
      "“Kitchen” is kept for the archive.",
    ]);
    await saveEnded(form);
    await expect(form.title()).not.toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );
    await expect(form.title()).toHaveValue("Kitchen");
  },
};

export const OneAtAFieldAndOneWithoutAreEachShownInTheirPlace: Story = {
  loaders: [loadRefused(RESERVED, FULL)],
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);

    await expect(await reasonsInTheNotice()).toEqual(["This space holds no more than 3 entries."]);
    await expect(form.title()).toHaveAccessibleDescription("“Kitchen” is kept for the archive.");
  },
};

export const ACheckOutranksAReasonAtTheSameField: Story = {
  loaders: [loadRefused({ ...RESERVED, field: "description" })],
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    // A failed Check first: from then on every change checks the whole draft (D321).
    await form.save();
    await fillInAndSave(form);
    await waitFor(() =>
      expect(form.description()).toHaveAccessibleDescription("“Kitchen” is kept for the archive."),
    );

    // A title equal to the description breaks a rule the Check reports at the description.
    await userEvent.clear(form.title());
    await userEvent.type(form.title(), "Paint the walls.");
    await expect(form.description()).toHaveAccessibleDescription(
      "The description must differ from the title.",
    );
    // Once the rule holds again, the Reason shows again: its field did not change.
    await userEvent.type(form.title(), "!");
    await expect(form.description()).toHaveAccessibleDescription(
      "“Kitchen” is kept for the archive.",
    );
  },
};

export const TheMessageFollowsALanguageSwitch: Story = {
  loaders: [loadRefused(COLOR_DELETED)],
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await fillInAndSave(form);
    await waitFor(() =>
      expect(form.color()).toHaveAccessibleDescription("The linked entry is no longer available."),
    );

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Deutsch" }));
    await waitFor(() =>
      expect(form.color()).toHaveAccessibleDescription(
        "Der verknüpfte Eintrag (Eintrag) ist nicht mehr verfügbar.",
      ),
    );
  },
};

/**
 * A form that maps the column `description` but shows no description field, and names the entry
 * the Notice of a refused save concerns.
 */
function FormWithoutItsDescription({ created }: { readonly created: () => void }) {
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: { title: "Kitchen", description: "Paint the walls.", icon: null, color: null },
    entryName: "Kitchen",
    onSuccess: created,
  });
  return (
    <Stack>
      <TextField form={form} name="title" label="Title" />
      <Button onClick={() => void form.submit()}>Save</Button>
    </Stack>
  );
}

export const AReasonAtAFieldTheFormDoesNotShowGoesToTheNoticeWithTheEntry: Story = {
  loaders: [loadRefused({ ...RESERVED, field: "description" }, FULL)],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access} reasonTexts={texts}>
      <FormWithoutItsDescription created={(loaded as Loaded).created} />
    </DataProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));

    // No Reason is lost: the one whose field is not on screen joins the Notice, under the entry.
    await expect(await reasonsInTheNotice()).toEqual([
      "“Kitchen” is kept for the archive.",
      "This space holds no more than 3 entries.",
    ]);
    await expect(noticeOnScreen()?.querySelector(".mantine-Notification-title")?.textContent).toBe(
      "Kitchen",
    );
  },
};
